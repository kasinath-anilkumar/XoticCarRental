import Link from "next/link";

import { CarCard } from "@/components/CarCard";
import { HowItWorks } from "@/components/content/HowItWorks";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { CityCard } from "@/components/cards/CityCard";
import { ServiceCard } from "@/components/cards/ServiceCard";
import { HomeSearch } from "@/components/home/HomeSearch";
import { LivePricing } from "@/components/home/LivePricing";
import { WholeFleet } from "@/components/home/WholeFleet";
import { ScrollHero } from "@/components/home/ScrollHero";
import { Icon } from "@/components/ui/Icon";
import { featuredCars, isoTomorrow, tripDefaults } from "@/lib/catalog";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { getCatalog } from "@/lib/content";
import { getHeroFrames } from "@/lib/hero-frames";
import { SERVICES } from "@/lib/services";


// Content changes rarely and every visitor sees the same page; regenerate
// hourly rather than on every request.
export const revalidate = 3600;

export default async function HomePage() {
  const [catalog, heroFrames] = await Promise.all([getCatalog(), getHeroFrames()]);
  const packages = catalog.packages;
  const defaultPackage = packages[0];
  const pricingAvailable = isPricingAvailable(catalog);

  // The trip the live pricing panel and the search card start from. Only the
  // pickup TIME affects the arithmetic, never the date, so the seed trip can
  // carry a fixed date and this page stays statically renderable; the search
  // card gets today separately so its calendar has a real floor.
  const seedTrip = tripDefaults(catalog, "2026-01-01");
  const today = isoTomorrow(new Date());

  return (
    <>
      <ScrollHero frames={heroFrames} />

      {/* The pickup starts empty on purpose: the visitor's own location is one
          tap away inside the field, and a prefilled Kochi is a wrong answer for
          everyone who is not in Kochi. */}
      <div id="journey-search" tabIndex={-1} className="relative z-2 scroll-mt-[calc(var(--header-height)+20px)] -mt-[24px] px-[var(--gutter-desktop)] max-md:mt-0 max-md:px-[var(--gutter-mobile)] max-md:pb-[20px]">
        {pricingAvailable ? <HomeSearch
          locations={catalog.locations}
          cities={catalog.cities.map((city) => ({
            slug: city.slug,
            name: city.name,
            state: city.state,
          }))}
          packages={packages.map((p) => ({ slug: p.slug, label: p.label, sub: p.sub }))}
          defaults={{ from: "", date: "", packageSlug: seedTrip.packageSlug }}
          minDate={today}
        /> : <PricingUnavailable />}
      </div>

      {/* ── services ──────────────────────────────────────────────────── */}
      <section className="sec">
        <div className="sec-head">
          <div>
            <p className="kick">What we drive for</p>
            <h2 className="h2">What is the journey for?</h2>
          </div>
          <Link href="/services" className="inline-flex items-center gap-2 text-[13px] whitespace-nowrap">
            All ten services <Icon name="ph-arrow-right" size={14} />
          </Link>
        </div>
        <div className="grid-4">
          {SERVICES.slice(0, 8).map((service) => (
            <ServiceCard
              key={service.slug}
              service={service}
              // The photograph belongs to the occasion the service is priced on.
              image={
                catalog.occasions.find((o) => o.slug === service.occasionSlug)?.heroImage ?? null
              }
            />
          ))}
        </div>
      </section>

      {/* ── cities ────────────────────────────────────────────────────── */}
      <section className="on-dark bg-[linear-gradient(135deg,#100804_0%,#010101_48%,#160802_100%)] px-[var(--gutter-desktop)] py-[56px] max-lg:py-10 max-md:px-[var(--gutter-mobile)] max-md:py-7">
        <div className="mb-7 flex items-end justify-between gap-6 max-md:mb-5 max-md:flex-col max-md:items-start max-md:gap-4">
          <div>
            <p className="kick">Where you need us</p>
            <h2 className="h2">Popular cities</h2>
          </div>
          <Link href="/cities" className="inline-flex items-center gap-2 text-[13px] whitespace-nowrap">
            All cities <Icon name="ph-arrow-right" size={14} />
          </Link>
        </div>
        <div className="grid-6">
          {catalog.cities.slice(0, 12).map((city) => (
            <CityCard key={city.slug} city={city} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--color-neutral-800)] bg-surface/40 px-5 py-3.5 max-md:p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent-300)]">
              <Icon name="ph-map-pin" size={18} />
            </span>
            <div>
              <p className="font-[family-name:var(--font-heading)] text-[14px] font-semibold text-text">
                Operating across 20+ metropolitan hubs & 28 states
              </p>
              <p className="text-[12px] text-[var(--color-neutral-400)]">
                Airport transfers, local packages, and cross-border touring throughout India.
              </p>
            </div>
          </div>
          <Link href="/cities" className="btn btn-ghost text-[13px] max-md:w-full">
            <span>Explore all 20 cities & rates</span>
            <Icon name="ph-arrow-right" size={14} />
          </Link>
        </div>
      </section>

      {/* ── featured cars ─────────────────────────────────────────────── */}
      {pricingAvailable && <section className="sec sec-tight mt-4">
        <div className="sec-head">
          <div>
            <p className="kick">Ready now</p>
            <h2 className="h2">Featured cars</h2>
          </div>
          <Link href="/cars" className="inline-flex items-center gap-2 text-[13px] whitespace-nowrap">
            Browse all cars <Icon name="ph-arrow-right" size={14} />
          </Link>
        </div>
        <div className="grid-cars">
          {featuredCars(catalog).map((car) => (
            <CarCard key={car.slug} catalog={catalog} car={car} pkg={defaultPackage} />
          ))}
        </div>
      </section>}

      {/* ── how it works ──────────────────────────────────────────────── */}
      <section className="sec sec-tight">
        <HowItWorks settings={catalog.settings} />
      </section>

      {/* ── transparent pricing, live ─────────────────────────────────── */}
      {pricingAvailable && <section className="on-dark bg-[linear-gradient(120deg,var(--color-band-from),var(--color-band-to))] px-[var(--gutter-desktop)] py-[56px] max-md:px-[var(--gutter-mobile)] max-md:py-[28px]">
        <LivePricing catalog={catalog} initialTrip={seedTrip} />
      </section>}

      {/* ── the whole fleet ───────────────────────────────────────────── */}
      {/*
        The four above are a shop window; this is the stock list. Somebody who
        scrolled this far has decided they are interested and now wants to know
        what there IS — and the answer, in one screen, is more persuasive than
        another band of copy about how the pricing works. That explanation now
        lives on the fleet, vehicle and city pages, which is where a visitor is
        actually deciding what a trip will cost.
      */}
      {pricingAvailable && <section className="sec sec-tight">
        <div className="sec-head mb-6">
          <div>
            <p className="kick">The whole fleet</p>
            <h2 className="h2 max-w-[620px]">A car for the entrance, the road and everything in between</h2>
          </div>
          <Link href="/cars" className="btn btn-solid min-h-[44px] shrink-0 text-[13px]">
            Browse all vehicles <Icon name="ph-arrow-right" size={15} />
          </Link>
        </div>

        <WholeFleet catalog={catalog} defaultPackage={defaultPackage} />
      </section>}

      {/* ── why ───────────────────────────────────────────────────────── */}
      <section className="sec">
        <p className="kick">Why Xotic</p>
        <h2 className="h2" style={{ marginBottom: "22.4px" }}>
          Built for occasions that cannot go wrong
        </h2>
        <div className="grid-5">
          {catalog.settings.whyItems.map((item) => (
            <div key={item.title}>
              <Icon name={item.icon} size={28} color="var(--color-accent)" />
              <p className="mt-3 mb-[4px] font-[family-name:var(--font-heading)] text-[16px]">{item.title}</p>
              <p className="text-[12px] text-[var(--color-neutral-500)] [text-wrap:pretty]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
