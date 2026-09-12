import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "./supabase/server";
import { PUBLIC_CATALOG_REVALIDATE, PUBLIC_CATALOG_TAG } from "./catalog-cache";
import { readKeysetPages } from "./pagination";
import type {
  Garage,
  Car,
  CarImage,
  City,
  CityRoute,
  LocationPoint,
  Occasion,
  Package,
  Season,
  SiteSettings,
} from "./types";

/**
 * The whole catalog in one object.
 *
 * Pricing currently needs a fleet snapshot to evaluate proximity and transfer
 * costs. Reads are shared across visitors for five minutes and fetched in
 * bounded batches, so the database row cap cannot silently remove vehicles.
 * Private enquiries and live availability never enter this public cache.
 */
export interface Catalog {
  cities: City[];
  locations: LocationPoint[];
  /** Internal: vehicle bases, for garage-to-garage pricing (§9). */
  garages: Garage[];
  packages: Package[];
  occasions: Occasion[];
  cars: Car[];
  cityRoutes: CityRoute[];
  carTypes: string[];
  /** Recurring peak windows (§10). */
  seasons: Season[];
  settings: SiteSettings;
  /** False when the site is running off seed content with no database. */
  live: boolean;
}

/**
 * Deduplicated per render pass; the anonymous client's fetch cache also shares
 * successful reads across requests. Failed reads are not cached as seed data.
 */
export const getCatalog = cache(async (): Promise<Catalog> => {
  if (!isSupabaseConfigured()) return seedCatalog();
  try {
    return await fetchCatalog();
  } catch (error) {
    // A misconfigured or unreachable database should not take the marketing
    // site down; fall back to the seeded content and say so in the log.
    // A new developer's project may not have its schema yet. Keep the warning
    // visible without opening a development error overlay over the fallback.
    const report = process.env.NODE_ENV === "development" ? console.warn : console.error;
    report("[content] Supabase read failed, falling back to seed content:", error);
    return seedCatalog();
  }
});

// ── database ────────────────────────────────────────────────────────────────

async function fetchCatalog(): Promise<Catalog> {
  // Never attach staff cookies to shared data. Aside from fragmenting the
  // cache, an admin session can read unpublished relations through RLS.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          cache: "force-cache",
          next: { revalidate: PUBLIC_CATALOG_REVALIDATE, tags: [PUBLIC_CATALOG_TAG] },
        }),
      },
    },
  );

  const [cities, locations, garages, packages, occasions, cars, carTypes, cityRoutes, seasons, settings] =
    await Promise.all([
      readPublicRows(supabase, "cities"),
      readPublicRows(supabase, "locations"),
      readPublicRows(supabase, "garages", "*, cities(slug)"),
      readPublicRows(supabase, "packages"),
      readPublicRows(supabase, "occasions", "*, occasion_includes(*), occasion_packages(*)"),
      readPublicRows(supabase, "cars", "*, car_types(slug, name), cities!cars_home_city_id_fkey(slug), car_images(*), car_occasions(occasions(slug)), car_service_cities(cities(slug)), garages(slug)"),
      readPublicRows(supabase, "car_types", "*", false),
      readPublicRows(supabase, "city_routes", "*, cities(slug), from_location:locations!city_routes_from_location_id_fkey(slug), to_location:locations!city_routes_to_location_id_fkey(slug)"),
      readPublicRows(supabase, "seasons"),
      supabase.from("site_settings").select("*").limit(1).maybeSingle(),
    ]);

  if (settings.error) throw settings.error;

  const cityById = new Map<string, string>();
  for (const row of cities) cityById.set(row.id, row.slug);

  return {
    live: true,
    cities: cities.map(mapCity),
    locations: locations.map((row) => mapLocation(row, cityById)),
    garages: garages.map(mapGarage),
    packages: packages.map(mapPackage),
    occasions: occasions.map(mapOccasion),
    cars: cars.map(mapCar),
    carTypes: carTypes.map((row) => row.name as string),
    cityRoutes: cityRoutes.map(mapCityRoute),
    seasons: seasons.sort((a, b) => a.starts_on.localeCompare(b.starts_on)).map(mapSeason),
    settings: mapSettings(settings.data),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function readPublicRows(
  supabase: SupabaseClient,
  table: string,
  columns = "*",
  activeOnly = true,
): Promise<any[]> {
  const rows = await readKeysetPages<any>(async (after) => {
    let query = supabase.from(table).select(columns).order("id").limit(200);
    if (activeOnly) query = query.eq("is_active", true);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
  // The id ordering makes pagination deterministic; merchandising order is
  // applied once all batches arrive, preserving the existing pricing inputs.
  return rows.sort(bySort);
}

function mapCity(row: any): City {
  return {
    slug: row.slug,
    name: row.name,
    state: row.state,
    multiplier: Number(row.multiplier),
    carCount: row.car_count,
    lat: row.lat,
    lng: row.lng,
    heroImage: row.hero_image ?? null,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
  };
}

function mapLocation(row: any, cityById: Map<string, string>): LocationPoint {
  return {
    slug: row.slug,
    name: row.name,
    citySlug: cityById.get(row.city_id) ?? "",
    lat: row.lat,
    lng: row.lng,
    isAirport: row.is_airport,
  };
}

function mapPackage(row: any): Package {
  return {
    slug: row.slug,
    label: row.label,
    hours: Number(row.hours),
    km: row.km,
    rateKey: row.rate_key,
    sub: row.sub,
    icon: row.icon,
  };
}

function mapOccasion(row: any): Occasion {
  const includes = [...(row.occasion_includes ?? [])].sort(bySort);
  const packages = [...(row.occasion_packages ?? [])].sort(bySort);
  return {
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    tagline: row.tagline,
    surcharge: row.surcharge,
    handlingNote: row.handling_note ?? "",
    kicker: row.kicker,
    title: row.title,
    blurb: row.blurb,
    h2: row.h2,
    fleetTitle: row.fleet_title,
    ctaTitle: row.cta_title,
    note: row.note,
    heroImage: row.hero_image ?? null,
    includes: includes.map((i: any) => ({ title: i.title, detail: i.detail })),
    packages: packages.map((p: any) => ({
      name: p.name,
      detail: p.detail,
      price: p.price,
      unit: p.unit,
    })),
  };
}

function mapGarage(row: any): Garage {
  return {
    slug: row.slug,
    name: row.name,
    citySlug: row.cities?.slug ?? "",
    lat: row.lat,
    lng: row.lng,
  };
}

function mapCar(row: any): Car {
  const images = [...(row.car_images ?? [])].sort(bySort);
  return {
    slug: row.slug,
    name: row.name,
    year: row.year,
    type: row.car_types?.name ?? "",
    seats: row.seats,
    transmission: row.transmission,
    fuel: row.fuel,
    homeCitySlug: row.cities?.slug ?? "",
    garageSlug: row.garages?.slug ?? null,
    rating: Number(row.rating).toFixed(1),
    badge: row.badge,
    rate8h: row.rate_8h,
    rate12h: row.rate_12h,
    rateFull: row.rate_full,
    extraKmRate: row.extra_km_rate,
    extraHrRate: row.extra_hr_rate,
    bata: row.bata,
    nightCharge: row.night_charge,
    serviceCitySlugs: (row.car_service_cities ?? [])
      .map((link: any) => link.cities?.slug)
      .filter(Boolean),
    occasions: (row.car_occasions ?? [])
      .map((link: any) => link.occasions?.slug)
      .filter(Boolean),
    images: images.map(
      (img: any): CarImage => ({ url: img.url, kind: img.kind, alt: img.alt ?? null }),
    ),
  };
}

function mapCityRoute(row: any): CityRoute {
  return {
    citySlug: row.cities?.slug ?? "",
    fromSlug: row.from_location?.slug ?? "",
    toSlug: row.to_location?.slug ?? "",
    kmOverride: row.km_override ?? null,
  };
}

function mapSeason(row: any): Season {
  return {
    slug: row.slug,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    multiplier: Number(row.multiplier),
    note: row.note ?? "",
    isActive: row.is_active ?? true,
  };
}

function mapSettings(row: any): SiteSettings {
  if (!row) return seedSettings();
  return {
    whatsappNumber: row.whatsapp_number,
    phoneDisplay: row.phone_display,
    email: row.email,
    gstPercent: Number(row.gst_percent),
    advancePercent: Number(row.advance_percent),
    circuityFactor: Number(row.circuity_factor),
    inclusions: row.inclusions ?? [],
    exclusions: row.exclusions ?? [],
    whyItems: row.why_items ?? [],
    charges: row.charges ?? [],
  };
}

function bySort(a: any, b: any): number {
  return (a.sort ?? 0) - (b.sort ?? 0);
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── seed fallback ───────────────────────────────────────────────────────────

/**
 * Test photography for the seeded content, from `node scripts/media.mjs`.
 *
 * Every image slot renders an empty well until something is uploaded, which is
 * right in production and useless for judging a layout — you cannot tell
 * whether a price still reads over a photograph when there is no photograph.
 * The generated plates in public/media fill every slot, and they are named by
 * slug so this is a convention rather than a table to maintain.
 *
 * They travel with the seed and only with the seed: the moment Supabase is
 * configured, the images come from the database and none of this is reached.
 */
const SHOTS = ["hero", "interior", "rear", "detail"] as const;

/** Missing seed photography uses Media's empty state instead of requesting a 404. */
function seedImage(path: string): string | null {
  return existsSync(join(process.cwd(), "public", path.slice(1))) ? path : null;
}

function seedCarImages(slug: string, name: string): CarImage[] {
  return SHOTS.flatMap((kind) => {
    const url = seedImage(`/media/cars/${slug}-${kind}.png`);
    return url ? [{ url, kind, alt: `${name} — ${kind === "hero" ? "side profile" : kind}` }] : [];
  });
}

/**
 * The site renders from backend/seed-data.js when no database is configured.
 *
 * This is not a mock: it is the same content the seed script loads, so the
 * pages you see before wiring Supabase are the pages you get after. It keeps
 * the build and the preview working before credentials exist, and disappears
 * the moment NEXT_PUBLIC_SUPABASE_URL is set.
 */
function seedCatalog(): Catalog {
  // Required lazily so the seed content is not pulled into a build that has a
  // real database configured.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const seed = require("@/backend/seed-data") as SeedData;
  /* eslint-enable @typescript-eslint/no-require-imports */

  const typeName = new Map(seed.carTypes.map((t) => [t.slug, t.name]));

  return {
    live: false,
    cities: seed.cities.map((c) => ({
      slug: c.slug,
      name: c.name,
      state: c.state,
      multiplier: c.multiplier,
      carCount: c.carCount,
      lat: c.lat,
      lng: c.lng,
      heroImage: seedImage(`/media/cities/${c.slug}.png`),
      seoTitle: null,
      seoDescription: null,
    })),
    garages: seed.garages.map((g) => ({
      slug: g.slug,
      name: g.name,
      citySlug: g.city,
      lat: g.lat,
      lng: g.lng,
    })),
    locations: seed.locations.map((l) => ({
      slug: l.slug,
      name: l.name,
      citySlug: l.city,
      lat: l.lat,
      lng: l.lng,
      isAirport: Boolean(l.airport),
    })),
    packages: seed.packages.map((p) => ({
      slug: p.slug,
      label: p.label,
      hours: p.hours,
      km: p.km,
      rateKey: p.rateKey,
      sub: p.sub,
      icon: p.icon,
    })),
    occasions: seed.occasions.map((o) => ({
      slug: o.slug,
      name: o.name,
      icon: o.icon,
      tagline: o.tagline,
      surcharge: o.surcharge,
      handlingNote: o.handlingNote,
      kicker: o.kicker,
      title: o.title,
      blurb: o.blurb,
      h2: o.h2,
      fleetTitle: o.fleetTitle,
      ctaTitle: o.ctaTitle,
      note: o.note,
      heroImage: seedImage(`/media/occasions/${o.slug}.png`),
      includes: o.includes,
      packages: o.packages,
    })),
    cars: seed.cars.map((c) => ({
      slug: c.slug,
      name: c.name,
      year: c.year,
      type: typeName.get(c.type) ?? c.type,
      seats: c.seats,
      transmission: c.transmission,
      fuel: c.fuel,
      homeCitySlug: c.city,
      garageSlug: c.garage ?? null,
      serviceCitySlugs: c.serviceCities ?? [],
      rating: c.rating.toFixed(1),
      badge: c.badge,
      rate8h: c.rate8h,
      rate12h: c.rate12h,
      rateFull: c.rateFull,
      extraKmRate: c.extraKmRate,
      extraHrRate: c.extraHrRate,
      bata: c.bata,
      nightCharge: c.nightCharge,
      occasions: c.occasions,
      images: seedCarImages(c.slug, c.name),
    })),
    carTypes: seed.carTypes.map((t) => t.name),
    seasons: seed.seasons.map((s) => ({ ...s, isActive: true })),
    cityRoutes: seed.cityRoutes.map((r) => ({
      citySlug: r.city,
      fromSlug: r.from,
      toSlug: r.to,
      kmOverride: r.km ?? null,
    })),
    settings: seedSettings(),
  };
}

function seedSettings(): SiteSettings {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const seed = require("@/backend/seed-data") as SeedData;
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { ...seed.settings };
}

/** The shape of backend/seed-data.js, which is plain CommonJS. */
interface SeedData {
  cities: Array<{
    slug: string; name: string; state: string; multiplier: number;
    carCount: number; lat: number; lng: number;
  }>;
  locations: Array<{
    slug: string; name: string; city: string; lat: number; lng: number; airport?: boolean;
  }>;
  garages: Array<{
    slug: string; name: string; city: string; lat: number; lng: number;
  }>;
  carTypes: Array<{ slug: string; name: string }>;
  seasons: Array<Omit<Season, "isActive">>;
  packages: Array<{
    slug: string; label: string; hours: number; km: number;
    rateKey: Package["rateKey"]; sub: string; icon: string;
  }>;
  cars: Array<{
    slug: string; name: string; year: number; type: string; seats: number;
    transmission: string; fuel: string; city: string; garage?: string;
    /** Absent means the car travels anywhere Xotic serves (§6). */
    serviceCities?: string[];
    rating: number; badge: string;
    occasions: string[]; rate8h: number; rate12h: number; rateFull: number;
    extraKmRate: number; extraHrRate: number; bata: number; nightCharge: number;
  }>;
  occasions: Array<
    Omit<Occasion, "heroImage"> & { includes: Occasion["includes"]; packages: Occasion["packages"] }
  >;
  cityRoutes: Array<{ city: string; from: string; to: string; km?: number }>;
  settings: SiteSettings;
}
