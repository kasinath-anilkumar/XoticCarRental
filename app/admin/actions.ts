"use server";

import { revalidatePath, updateTag } from "next/cache";

import { requireAdmin } from "@/lib/admin/auth";
import { PUBLIC_CATALOG_TAG } from "@/lib/catalog-cache";
import { isISODate } from "@/lib/dates";
import { LEAD_STATUSES } from "@/lib/leads";
import { parsePricingRules } from "@/lib/pricing-rules";
import { getStore } from "@/lib/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExtraCharge } from "@/lib/types";

/**
 * Admin mutations.
 *
 * Every action calls requireAdmin() first and writes through the *user's*
 * Supabase client, not the service-role one — so RLS is the real check and a
 * missing guard here cannot become a data breach. The shared public catalog
 * cache is invalidated on write so other pages see the updated rates too.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

function ok(message: string): ActionResult {
  return { ok: true, message };
}

function fail(message: string): ActionResult {
  return { ok: false, message };
}

/** Public pages that reflect fleet or content changes. */
function revalidatePublic(paths: string[] = []) {
  updateTag(PUBLIC_CATALOG_TAG);
  revalidatePath("/");
  revalidatePath("/cars");
  for (const path of paths) revalidatePath(path);
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function num(form: FormData, key: string, fallback = 0): number {
  const raw = text(form, key);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function optionalNum(form: FormData, key: string): number | null {
  const raw = text(form, key);
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function bool(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}

function placeValidation(form: FormData, city = false): string | null {
  if (!text(form, "name") || text(form, "name").length > 200) return "Enter a name of 200 characters or fewer.";
  for (const [key, limit] of [["lat", 90], ["lng", 180]] as const) {
    const raw = text(form, key);
    if (!raw || !Number.isFinite(Number(raw)) || Math.abs(Number(raw)) > limit) return `Enter valid ${key === "lat" ? "latitude" : "longitude"} coordinates.`;
  }
  if (city) {
    if (!text(form, "state") || text(form, "state").length > 100) return "Enter the city's state or region.";
    const multiplier = Number(text(form, "multiplier"));
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 99.99) return "Enter a rate multiplier greater than zero and no more than 99.99.";
    const count = Number(text(form, "car_count"));
    if (!Number.isInteger(count) || count < 0) return "Enter a non-negative whole car count.";
  } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text(form, "city_id"))) return "Choose a saved service city.";
  return null;
}

// ── fleet ───────────────────────────────────────────────────────────────────

export async function updateCar(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const id = text(form, "id");
  if (!id) return fail("Missing car id.");

  const rawYear = text(form, "year");
  const year = rawYear ? Number(rawYear) : 2020;
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return fail("Vehicle year must be a whole number between 1900 and 2100.");
  }

  const selectedIds = (key: string) => [...new Set(form.getAll(key).filter(
    (value): value is string => typeof value === "string" && value !== "",
  ))];

  // One database transaction: a bad relation must not erase service cities
  // or leave a new rate card paired with the previous occasion selection.
  const { error } = await supabase.rpc("save_car_details", {
    p_car_id: id,
    p_occasion_ids: selectedIds("occasion_ids"),
    p_service_city_ids: selectedIds("service_city_ids"),
    p_values: {
      name: text(form, "name"),
      year,
      seats: num(form, "seats", 4),
      transmission: text(form, "transmission"),
      fuel: text(form, "fuel"),
      car_type_id: text(form, "car_type_id"),
      home_city_id: text(form, "home_city_id"),
      // Where this car actually lives. It is the point every quote measures
      // from (§9), so it has to be editable without a developer (§18) — and
      // empty is a real answer: fall back to the city centre.
      garage_id: text(form, "garage_id") || null,
      rating: num(form, "rating", 4.5),
      badge: text(form, "badge"),
      rate_8h: num(form, "rate_8h"),
      rate_12h: num(form, "rate_12h"),
      rate_full: num(form, "rate_full"),
      extra_km_rate: num(form, "extra_km_rate"),
      extra_hr_rate: num(form, "extra_hr_rate"),
      bata: num(form, "bata"),
      night_charge: num(form, "night_charge"),
      is_active: bool(form, "is_active"),
      sort: num(form, "sort"),
    },
  });

  if (error) return fail(error.message);

  const slug = text(form, "slug");
  revalidatePublic([`/cars/${slug}`]);
  return ok("Car saved.");
}

export async function setCarActive(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const id = text(form, "id");
  const active = text(form, "active") === "true";

  const { error } = await supabase.from("cars").update({ is_active: active }).eq("id", id);
  if (error) return fail(error.message);

  revalidatePublic();
  return ok(active ? "Car published." : "Car hidden from the site.");
}

// ── car photography ─────────────────────────────────────────────────────────
//
// §18: staff upload photos without a developer. The file goes to a public
// Storage bucket and its public URL is recorded on car_images — the same shape
// the seeded rows already use, so nothing downstream has to know which of the
// two put it there.
//
// Alt text is required here even though the column is nullable: §24 asks for
// it, a screen reader has nothing else to go on, and the moment to write it is
// while the person can see the picture.

/** What a browser will actually render, and we will actually accept. */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const PHOTO_MAX_BYTES = 6 * 1024 * 1024;

export async function uploadCarPhoto(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const carId = text(form, "car_id");
  const slug = text(form, "slug");
  const kind = text(form, "kind") || "hero";
  const alt = text(form, "alt");
  const file = form.get("file");

  if (!carId) return fail("Missing car id.");
  if (!alt) return fail("Describe the photograph — it is what a screen reader reads out.");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image first.");
  if (!PHOTO_TYPES.includes(file.type)) {
    return fail("That file is not a JPEG, PNG, WebP or AVIF.");
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return fail(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 6 MB.`);
  }

  // Named by car and kind, with a timestamp so re-uploading the same shot does
  // not collide with the copy already on a live page.
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${slug || carId}/${kind}-${Date.now()}.${extension}`;

  const upload = await supabase.storage
    .from("car-photos")
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });

  if (upload.error) return fail(upload.error.message);

  const { data } = supabase.storage.from("car-photos").getPublicUrl(path);

  const { error } = await supabase.from("car_images").insert({
    car_id: carId,
    url: data.publicUrl,
    kind,
    alt,
    sort: num(form, "sort", 0),
  });

  // The row is what the site reads. Without it the file is an orphan taking up
  // space, so it goes back out rather than being left behind.
  if (error) {
    await supabase.storage.from("car-photos").remove([path]);
    return fail(error.message);
  }

  revalidatePublic([`/cars/${slug}`]);
  return ok("Photo added.");
}

export async function updateCarPhoto(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const alt = text(form, "alt");
  if (!alt) return fail("Alt text cannot be emptied.");

  const { error } = await supabase
    .from("car_images")
    .update({ kind: text(form, "kind"), alt, sort: num(form, "sort") })
    .eq("id", text(form, "id"));

  if (error) return fail(error.message);

  revalidatePublic([`/cars/${text(form, "slug")}`]);
  return ok("Photo saved.");
}

export async function deleteCarPhoto(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const id = text(form, "id");
  const url = text(form, "url");

  const { error } = await supabase.from("car_images").delete().eq("id", id);
  if (error) return fail(error.message);

  // Only ours to delete: a seeded row points at /media, not at the bucket.
  const marker = "/storage/v1/object/public/car-photos/";
  const at = url.indexOf(marker);
  if (at !== -1) {
    await supabase.storage.from("car-photos").remove([url.slice(at + marker.length)]);
  }

  revalidatePublic([`/cars/${text(form, "slug")}`]);
  return ok("Photo removed.");
}

// ── seasons ─────────────────────────────────────────────────────────────────
//
// §10. The multiplier is entered and shown as a percentage, because that is
// what staff say out loud and what the customer's quote line reads — an
// editor who types 1.2 meaning "20%" would cut the rate by four fifths, and
// nothing on the screen would look wrong.

function multiplierFromPercent(form: FormData): number {
  const percent = num(form, "percent", 0);
  return Math.round((1 + percent / 100) * 100) / 100;
}

/** MM-DD, both ends inclusive. */
function validWindow(startsOn: string, endsOn: string): boolean {
  // A leap year permits February 29 while rejecting impossible calendar days.
  return isISODate(`2000-${startsOn}`) && isISODate(`2000-${endsOn}`);
}

export async function createSeason(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const name = text(form, "name");
  const startsOn = text(form, "startsOn");
  const endsOn = text(form, "endsOn");
  if (!name) return fail("A name is required.");
  if (!validWindow(startsOn, endsOn)) {
    return fail("Dates are MM-DD, like 11-01.");
  }

  const { error } = await supabase.from("seasons").insert({
    slug: slugify(name),
    name,
    starts_on: startsOn,
    ends_on: endsOn,
    multiplier: multiplierFromPercent(form),
    note: text(form, "note"),
  });

  if (error) {
    return fail(
      /duplicate key/i.test(error.message)
        ? `A season called "${name}" already exists.`
        : error.message,
    );
  }

  revalidatePublic(["/price-calculator"]);
  return ok(`Added ${name}.`);
}

export async function updateSeason(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const startsOn = text(form, "startsOn");
  const endsOn = text(form, "endsOn");
  if (!validWindow(startsOn, endsOn)) {
    return fail("Dates are MM-DD, like 11-01.");
  }

  const { error } = await supabase
    .from("seasons")
    .update({
      name: text(form, "name"),
      starts_on: startsOn,
      ends_on: endsOn,
      multiplier: multiplierFromPercent(form),
      note: text(form, "note"),
      is_active: bool(form, "isActive"),
    })
    .eq("id", text(form, "id"));

  if (error) return fail(error.message);

  // Every open quote reprices from the next page load.
  revalidatePublic(["/price-calculator"]);
  return ok("Season saved.");
}

export async function deleteSeason(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("seasons").delete().eq("id", text(form, "id"));
  if (error) return fail(error.message);

  revalidatePublic(["/price-calculator"]);
  return ok("Season removed.");
}

// ── cities ──────────────────────────────────────────────────────────────────

export async function updateCity(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const validation = placeValidation(form, true);
  if (validation) return fail(validation);
  const supabase = await createSupabaseServerClient();

  const id = text(form, "id");
  const { error } = await supabase
    .from("cities")
    .update({
      name: text(form, "name"),
      state: text(form, "state"),
      multiplier: num(form, "multiplier", 1),
      car_count: num(form, "car_count"),
      lat: num(form, "lat"),
      lng: num(form, "lng"),
      seo_title: text(form, "seo_title") || null,
      seo_description: text(form, "seo_description") || null,
      is_active: bool(form, "is_active"),
    })
    .eq("id", id);

  if (error) return fail(error.message);

  revalidatePublic([`/cities/${text(form, "slug")}`, "/cities"]);
  return ok("City saved.");
}

export async function createCity(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const validation = placeValidation(form, true);
  if (validation) return fail(validation);
  const name = text(form, "name");
  const slug = slugify(name);
  if (!slug) return fail("Enter a city name that can be used in its page address.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cities").insert({
    name, slug, state: text(form, "state"), lat: Number(text(form, "lat")), lng: Number(text(form, "lng")),
    multiplier: Number(text(form, "multiplier")), car_count: num(form, "car_count"),
    seo_title: text(form, "seo_title") || null, seo_description: text(form, "seo_description") || null,
    is_active: bool(form, "is_active"),
  });
  if (error) return fail(error.code === "23505" ? "A city with this page address already exists." : error.message);
  revalidatePublic(["/cities", "/admin/cities"]);
  return ok(`Added ${name}.`);
}

// ── locations ───────────────────────────────────────────────────────────────

export async function createLocation(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const validation = placeValidation(form);
  if (validation) return fail(validation);
  const supabase = await createSupabaseServerClient();

  const name = text(form, "name");
  const slug = text(form, "slug") || slugify(name);
  if (!name || !slug) return fail("A name is required.");

  const { error } = await supabase.from("locations").insert({
    slug,
    name,
    city_id: text(form, "city_id"),
    lat: num(form, "lat"),
    lng: num(form, "lng"),
    is_airport: bool(form, "is_airport"),
    sort: num(form, "sort", 999),
  });

  if (error) {
    return fail(
      /duplicate key/i.test(error.message)
        ? `A location with the slug "${slug}" already exists.`
        : error.message,
    );
  }

  revalidatePublic(["/price-calculator", "/cities"]);
  return ok(`Added ${name}.`);
}

export async function updateLocation(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const validation = placeValidation(form);
  if (validation) return fail(validation);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("locations")
    .update({
      name: text(form, "name"),
      city_id: text(form, "city_id"),
      lat: num(form, "lat"),
      lng: num(form, "lng"),
      is_airport: bool(form, "is_airport"),
      is_active: bool(form, "is_active"),
      sort: num(form, "sort"),
    })
    .eq("id", text(form, "id"));

  if (error) return fail(error.message);

  revalidatePublic(["/price-calculator", "/cities"]);
  return ok("Location saved.");
}


// ── garages ─────────────────────────────────────────────────────────────────
//
// Internal, and the single most price-sensitive row in the database: every
// quote is measured from one of these points (§9). §18 requires staff to move a
// vehicle between garages, and a list of garages nobody can add to would make
// that a half-promise.

export async function createGarage(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const validation = placeValidation(form);
  if (validation) return fail(validation);
  const supabase = await createSupabaseServerClient();

  const name = text(form, "name");
  const slug = text(form, "slug") || slugify(name);
  if (!name || !slug) return fail("A name is required.");

  const { error } = await supabase.from("garages").insert({
    slug,
    name,
    city_id: text(form, "city_id"),
    lat: num(form, "lat"),
    lng: num(form, "lng"),
  });

  if (error) {
    return fail(
      /duplicate key/i.test(error.message)
        ? `A garage with the slug "${slug}" already exists.`
        : error.message,
    );
  }

  revalidatePublic(["/price-calculator"]);
  return ok(`Added ${name}.`);
}

export async function updateGarage(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const validation = placeValidation(form);
  if (validation) return fail(validation);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("garages")
    .update({
      name: text(form, "name"),
      city_id: text(form, "city_id"),
      lat: num(form, "lat"),
      lng: num(form, "lng"),
      is_active: bool(form, "is_active"),
    })
    .eq("id", text(form, "id"));

  if (error) return fail(error.message);

  // Moving a yard changes what every car based there costs to send out.
  revalidatePublic(["/price-calculator", "/cars"]);
  return ok("Garage saved.");
}

export async function deleteGarage(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const id = text(form, "id");

  // A car pointing at a deleted garage would fall back to its city centre
  // silently, and the quote would quietly change. Refuse instead.
  const { count, error: countError } = await supabase
    .from("cars")
    .select("id", { count: "exact", head: true })
    .eq("garage_id", id);

  if (countError) return fail("Could not check the vehicles at this garage. Please try again.");

  if ((count ?? 0) > 0) {
    return fail(
      `${count} vehicle${count === 1 ? " is" : "s are"} based here. Move them to another garage first.`,
    );
  }

  const { error } = await supabase.from("garages").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePublic(["/price-calculator"]);
  return ok("Garage removed.");
}


// ── packages ────────────────────────────────────────────────────────────────
//
// §18: packages are updated without a developer. §10 adds the reason it has to
// be here rather than in a constant — the pricing rules must not be hard-coded
// into the frontend, and "12 hrs / 120 km" is a pricing rule, not a label.
//
// The rate key is deliberately not editable. It names the column on every car
// that this package bills against, and repointing it would silently re-price
// the whole fleet; adding a fourth rate is a schema change and a migration.

export async function updatePackage(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const hours = num(form, "hours");
  const km = num(form, "km");
  if (hours <= 0 || km <= 0) return fail("Hours and kilometres both have to be above zero.");

  const { error } = await supabase
    .from("packages")
    .update({
      label: text(form, "label"),
      hours,
      km,
      sub: text(form, "sub"),
      icon: text(form, "icon") || "ph-clock",
      is_active: bool(form, "is_active"),
      sort: num(form, "sort"),
    })
    .eq("id", text(form, "id"));

  if (error) return fail(error.message);

  // The package is on the home search, every card and the calculator.
  revalidatePublic(["/price-calculator", "/cities"]);
  return ok("Package saved.");
}

// ── route fares ─────────────────────────────────────────────────────────────

export async function updateCityRoute(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("city_routes")
    .update({
      km_override: optionalNum(form, "km_override"),
      is_active: bool(form, "is_active"),
      sort: num(form, "sort"),
    })
    .eq("id", text(form, "id"));

  if (error) return fail(error.message);

  // A published distance is used by the calculator too, not only this table.
  revalidatePublic(["/cities", `/cities/${text(form, "city_slug")}`, "/price-calculator"]);
  return ok("Route saved.");
}

export async function createCityRoute(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const fromId = text(form, "from_location_id");
  const toId = text(form, "to_location_id");
  if (fromId === toId) return fail("A route needs two different locations.");

  const { error } = await supabase.from("city_routes").insert({
    city_id: text(form, "city_id"),
    from_location_id: fromId,
    to_location_id: toId,
    km_override: optionalNum(form, "km_override"),
    sort: num(form, "sort", 999),
  });

  if (error) {
    return fail(
      /duplicate key/i.test(error.message)
        ? "That route is already published for this city."
        : error.message,
    );
  }

  revalidatePublic(["/cities", "/price-calculator"]);
  return ok("Route added.");
}

export async function deleteCityRoute(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("city_routes").delete().eq("id", text(form, "id"));
  if (error) return fail(error.message);

  revalidatePublic(["/cities", "/price-calculator"]);
  return ok("Route removed.");
}

// ── occasions ───────────────────────────────────────────────────────────────

export async function updateOccasion(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("occasions")
    .update({
      name: text(form, "name"),
      tagline: text(form, "tagline"),
      surcharge: num(form, "surcharge"),
      handling_note: text(form, "handling_note"),
      kicker: text(form, "kicker"),
      title: text(form, "title"),
      blurb: text(form, "blurb"),
      h2: text(form, "h2"),
      fleet_title: text(form, "fleet_title"),
      cta_title: text(form, "cta_title"),
      note: text(form, "note"),
      is_active: bool(form, "is_active"),
    })
    .eq("id", text(form, "id"));

  if (error) return fail(error.message);

  revalidatePublic(["/occasions", `/occasions/${text(form, "slug")}`, "/price-calculator"]);
  return ok("Occasion saved.");
}

// ── settings ────────────────────────────────────────────────────────────────

export async function updateSettings(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const whatsapp = text(form, "whatsapp_number").replace(/\D/g, "");
  if (whatsapp.length < 10) {
    return fail("The WhatsApp number should be digits only, country code first.");
  }

  let pricingRules;
  try {
    pricingRules = parsePricingRules(Object.fromEntries(["minimumLegKm", "localSpeedKph", "outstationSpeedKph", "oneWayReturnPercent", "nightStartHour", "nightEndHour"].map((key) => [key, text(form, key) === "" ? undefined : Number(text(form, key))])));
  } catch (error) { return fail(error instanceof Error ? error.message : "Enter all pricing rules."); }
  for (const key of ["gst_percent", "advance_percent", "circuity_factor"]) {
    const value = Number(text(form, key));
    if (!text(form, key) || !Number.isFinite(value) || value < 0 || (key === "circuity_factor" ? value <= 0 || value > 10 : value > 100)) return fail("Enter valid tax, advance and road distance values.");
  }

  const { error } = await supabase
    .from("site_settings")
    .update({
      whatsapp_number: whatsapp,
      phone_display: text(form, "phone_display"),
      email: text(form, "email"),
      gst_percent: Number(text(form, "gst_percent")),
      advance_percent: Number(text(form, "advance_percent")),
      circuity_factor: Number(text(form, "circuity_factor")),
      pricing_rules: pricingRules,
      inclusions: splitLines(text(form, "inclusions")),
      exclusions: splitLines(text(form, "exclusions")),
    })
    .eq("id", true);

  if (error) return fail(error.message);

  // Settings touch every page — the phone number is in the header and footer.
  updateTag(PUBLIC_CATALOG_TAG);
  revalidatePath("/", "layout");
  return ok("Settings saved.");
}

/**
 * Tolls, parking and permits (§10).
 *
 * Saved as one jsonb array rather than a table: there are three of them, they
 * are edited together, and each is a switch and a number. The form posts them
 * as indexed fields, so the shape here is read back by position.
 */
export async function updateCharges(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const charges: ExtraCharge[] = [];
  for (let index = 0; index < 20; index += 1) {
    const key = text(form, `key-${index}`);
    if (!key) break;

    const appliesTo = text(form, `appliesTo-${index}`);
    const amount = text(form, `amount-${index}`);
    if (!text(form, `label-${index}`) || !amount || !Number.isFinite(Number(amount)) || Number(amount) < 0) return fail("Every charge needs a name and a non-negative amount.");
    if (!["always", "outstation", "interstate"].includes(appliesTo)) return fail("Choose when each charge applies.");
    charges.push({
      key,
      label: text(form, `label-${index}`),
      note: text(form, `note-${index}`),
      amount: Math.max(0, num(form, `amount-${index}`, 0)),
      appliesTo:
        appliesTo === "outstation" || appliesTo === "interstate" ? appliesTo : "always",
      isActive: bool(form, `isActive-${index}`),
    });
  }

  const { error } = await supabase
    .from("site_settings")
    .update({ charges })
    .eq("id", true);

  if (error) return fail(error.message);

  // A charge lands on every matching quote, so every cached page is stale.
  revalidatePublic(["/price-calculator", "/cities"]);
  const on = charges.filter((charge) => charge.isActive).length;
  return ok(
    on === 0
      ? "Saved. Nothing is billed — quotes say these are paid at actuals."
      : `Saved. ${on} ${on === 1 ? "charge is" : "charges are"} now billed on matching trips.`,
  );
}

// ── enquiries ───────────────────────────────────────────────────────────────

/**
 * Everything a staff member changes about a lead, in one save.
 *
 * Status, owner, next chase and note travel together because they are one
 * action — you ring a customer, and all four change at once. Splitting them
 * into four buttons is how a dashboard stops being used, which is the failure
 * mode §16 exists to prevent.
 */
export async function updateLead(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const status = text(form, "status");
  if (!LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
    return fail("Unknown status.");
  }

  const followUp = text(form, "followUpOn");
  if (followUp && !isISODate(followUp)) {
    return fail("Follow-up must be a date.");
  }

  try {
    await getStore().updateLead(text(form, "id"), {
      status: status as (typeof LEAD_STATUSES)[number],
      assignedTo: text(form, "assignedTo") || null,
      followUpOn: followUp || null,
      notes: text(form, "notes") || null,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update the lead.");
  }

  revalidatePath("/admin/enquiries");
  return ok("Lead updated.");
}

/**
 * A dated hold on a vehicle (§17).
 *
 * Availability is a range with a reason, not a switch: a car booked for the
 * 14th is available on the 15th, and `is_active` could never say that.
 */
export async function addAvailability(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const carSlug = text(form, "carSlug");
  const status = text(form, "status");
  const startsOn = text(form, "startsOn");
  const endsOn = text(form, "endsOn") || startsOn;

  if (!carSlug) return fail("Choose a vehicle.");
  if (!["booked", "unavailable", "maintenance", "hold"].includes(status)) {
    return fail("Unknown availability status.");
  }
  if (!isISODate(startsOn) || !isISODate(endsOn)) {
    return fail("Both dates are required.");
  }
  if (endsOn < startsOn) return fail("The last day cannot precede the first.");

  try {
    await getStore().addAvailability({
      carSlug,
      status: status as "booked" | "unavailable" | "maintenance" | "hold",
      startsOn,
      endsOn,
      note: text(form, "note") || null,
      leadId: null,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not save the hold.");
  }

  revalidatePath("/admin/availability");
  revalidatePath("/cars");
  return ok("Availability saved.");
}

export async function removeAvailability(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  try {
    await getStore().removeAvailability(text(form, "id"));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not remove the hold.");
  }
  revalidatePath("/admin/availability");
  revalidatePath("/cars");
  return ok("Hold removed.");
}

// ── helpers ─────────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
