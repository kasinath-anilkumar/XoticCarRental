import type { Metadata } from "next";
import Link from "next/link";

import { CitiesDirectory, type CityDirectoryItem } from "@/components/cities/CitiesDirectory";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { ChargesExplained } from "@/components/trust/ChargesExplained";
import { Icon } from "@/components/ui/Icon";
import {
  airportFor,
  carsBasedIn,
  cityFromPrice,
  cityRouteFares,
  pickupPointsIn,
  statesOf,
} from "@/lib/catalog";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { formatINR } from "@/lib/format";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Cities we drive in | Xotic Luxury Fleet",
  description:
    "Chauffeur-driven luxury car rental across India's premier metros and travel corridors. Transparent operating multipliers, curated fleet counts, and published intercity route fares.",
  alternates: { canonical: "/cities" },
};

export default async function CitiesPage() {
  const catalog = await getCatalog();
  if (!isPricingAvailable(catalog)) {
    return <section className="sec"><h1 className="mb-6">Cities we drive in</h1><PricingUnavailable /></section>;
  }

  const citiesData: CityDirectoryItem[] = catalog.cities.map((city) => {
    const fares = cityRouteFares(catalog, city);
    const airport = airportFor(catalog, city);
    const topRoute = fares[0]
      ? { name: fares[0].name, km: fares[0].km, price: fares[0].price }
      : null;

    return {
      slug: city.slug,
      name: city.name,
      state: city.state,
      multiplier: city.multiplier,
      heroImage: city.heroImage,
      carCount: city.carCount,
      basedCount: carsBasedIn(catalog, city).length,
      pickupsCount: pickupPointsIn(catalog, city).length,
      airportName: airport ? airport.name.replace(/\s*\(.*\)$/, "") : null,
      fromPrice: cityFromPrice(catalog, city),
      topRoute,
      fares: fares.map((f) => ({
        name: f.name,
        fromSlug: f.fromSlug,
        toSlug: f.toSlug,
        packageSlug: f.packageSlug,
        km: f.km,
        price: f.price,
      })),
    };
  });

  const totalRoutes = citiesData.reduce((sum, row) => sum + row.fares.length, 0);
  const states = statesOf(catalog);
  const defaultPackage = catalog.packages[0];

  return (
    <>
      {/* ── HERO BANNER ────────────────────────────────────────────── */}
      <section className="on-dark border-b border-[var(--color-divider)] bg-[linear-gradient(135deg,#0a0a0a_0%,#181818_100%)] px-[var(--gutter-desktop)] pt-12 pb-14 max-md:px-[var(--gutter-mobile)] max-md:pt-8 max-md:pb-10">
        <div className="max-w-[880px] mt-8">
          <p className="kick">Where we drive</p>
          <h1 className="mb-3 text-[36px] font-medium leading-tight max-lg:text-[30px] max-md:text-[26px]">
            {catalog.cities.length} cities across {states.length} states, one transparent price list
          </h1>
          <p className="max-w-[70ch] text-[15px] leading-relaxed text-[var(--color-neutral-300)] max-md:text-[13.5px]">
            Every city runs on the same rate card. The only difference is the operating multiplier
            applied to each package base — reflected upfront on every destination card below,
            never hidden in a surprise bill.
          </p>

          {/* Quick Metrics */}
          <div className="mt-8 grid max-w-[620px] grid-cols-3 divide-x divide-[var(--color-neutral-800)] border-y border-[var(--color-neutral-800)] py-3 max-md:mt-6 max-md:py-2.5">
            <div className="px-4 first:pl-0">
              <p className="font-[family-name:var(--font-heading)] text-[22px] font-semibold text-[var(--color-accent-300)] max-md:text-[18px]">
                {catalog.cities.length}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-500)]">
                Active Cities
              </p>
            </div>
            <div className="px-4">
              <p className="font-[family-name:var(--font-heading)] text-[22px] font-semibold text-[var(--color-accent-300)] max-md:text-[18px]">
                {states.length}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-500)]">
                States Served
              </p>
            </div>
            <div className="px-4">
              <p className="font-[family-name:var(--font-heading)] text-[22px] font-semibold text-[var(--color-accent-300)] max-md:text-[18px]">
                {totalRoutes}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-500)]">
                Intercity Routes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CITIES DIRECTORY & STATE EXPLORER ───────────────────────── */}
      <section className="sec">
        <CitiesDirectory
          cities={citiesData}
          states={states}
          totalRoutes={totalRoutes}
          defaultPackageLabel={defaultPackage.label}
          gstPercent={catalog.settings.gstPercent}
        />
      </section>

      {/* ── PUBLISHED INTERCITY ROUTES ──────────────────────────────── */}
      <section className="sec sec-tight border-t border-[var(--color-divider)]">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kick">Published fares</p>
            <h2 className="h2 m-0">Popular intercity routes</h2>
            <p className="mt-1 max-w-[65ch] text-[13.5px] text-[var(--color-neutral-400)]">
              Published route estimates. Add your pickup, drop and schedule in the calculator
              for the applicable trip charges.
            </p>
          </div>
          <Link href="/price-calculator" className="btn btn-ghost text-[13px]">
            <Icon name="ph-calculator" size={15} />
            <span>Custom route calculator</span>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-md:grid-cols-1">
          {citiesData
            .filter((row) => row.fares.length > 0)
            .flatMap((row) =>
              row.fares.slice(0, 2).map((fare) => (
                <div
                  key={`${fare.fromSlug}-${fare.toSlug}`}
                  className="flex flex-col justify-between rounded-lg border border-[var(--color-divider)] bg-surface p-4 shadow-xs transition-colors hover:border-[var(--color-accent)]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-text">
                        {fare.name}
                      </span>
                      <span className="rounded bg-well px-2 py-0.5 text-[11px] font-medium text-[var(--color-neutral-400)]">
                        {fare.km} km
                      </span>
                    </div>

                    <p className="mt-2 text-[12px] text-[var(--color-neutral-500)]">
                      Origin: {row.name} · Round trip or one-way drop
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[var(--color-divider)] pt-3">
                    <div>
                      <span className="block text-[10px] uppercase text-[var(--color-neutral-500)]">
                        Starting from
                      </span>
                      <span className="font-[family-name:var(--font-heading)] text-[16px] font-semibold text-[var(--color-accent-300)]">
                        {formatINR(fare.price)}
                      </span>
                    </div>

                    <Link
                      href={`/price-calculator?from=${fare.fromSlug}&to=${fare.toSlug}&pkg=${fare.packageSlug}&trip=round`}
                      className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-accent)] hover:text-text"
                    >
                      <span>Price trip</span>
                      <Icon name="ph-arrow-right" size={13} />
                    </Link>
                  </div>
                </div>
              )),
            )}
        </div>
      </section>

      {/* ── INCLUSIONS & SERVICE STANDARDS ─────────────────────────── */}
      <section className="sec sec-tight border-t border-[var(--color-divider)]">
        <p className="kick">The same everywhere</p>
        <h2 className="h2 mb-6">What a booking includes in every city</h2>

        <div className="grid grid-cols-3 gap-8 max-lg:grid-cols-2 max-md:grid-cols-1">
          <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-5">
            <p className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-text">
              Included in the price
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {catalog.settings.inclusions.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2.5 text-[13px] text-[var(--color-neutral-300)]"
                >
                  <Icon name="ph-check-circle" size={16} color="var(--color-accent)" className="shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-5">
            <p className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-text">
              At actuals, with receipt
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {catalog.settings.exclusions.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2.5 text-[13px] text-[var(--color-neutral-400)]"
                >
                  <Icon name="ph-receipt" size={16} color="var(--color-neutral-500)" className="shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-5 max-lg:col-span-full">
            <p className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-text">
              Transparent payment policy
            </p>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-neutral-400)]">
              {catalog.settings.gstPercent}% GST on the total. {catalog.settings.advancePercent}%
              advance holds your confirmed date against a GST tax invoice. No hidden commissions or
              surprise surge charges.
            </p>
            <Link href="/price-calculator" className="btn btn-primary mt-4 w-full min-h-[42px]">
              <Icon name="ph-calculator" size={15} />
              <span>Calculate exact fare</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── TRUST SECTION ─────────────────────────────────────────── */}
      <section className="sec sec-tight border-t border-[var(--color-divider)]">
        <ChargesExplained settings={catalog.settings} />
      </section>
    </>
  );
}
