import type { Metadata } from "next";
import Link from "next/link";

import { CitiesDirectory, type CityDirectoryItem } from "@/components/cities/CitiesDirectory";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { EditorialIntro, EditorialCTA, editorial } from "@/components/content/Editorial";
import { ChargesExplained } from "@/components/trust/ChargesExplained";
import { Icon } from "@/components/ui/Icon";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
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
    "Explore our service cities, chauffeur-driven fleet and route estimates. Choose your starting point and plan your journey.",
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

  return <div className={editorial.page}>
    <EditorialIntro eyebrow="Where we drive" title="Find car rentals in your city" description={`Compare chauffeur-driven cars across ${catalog.cities.length} service cities. Choose your city to see cars, pickup points and published route estimates.`} image={catalog.cities.find((city) => city.heroImage)?.heroImage ?? null} imageLabel="Discover our service locations" actions={<><Link href="#city-directory" className="btn btn-primary">Find your city <Icon name="ph-arrow-down" size={17} /></Link><Link href="/price-calculator" className="btn btn-secondary">Plan your journey</Link></>} />
    <section id="city-directory" aria-label="City directory" className={editorial.section}><div className={editorial.sectionHead}><div><p className={editorial.eyebrow}>Your starting point</p><h2>Where would you like to go?</h2></div></div><CitiesDirectory cities={citiesData} states={states} totalRoutes={totalRoutes} defaultPackageLabel={defaultPackage.label} gstPercent={catalog.settings.gstPercent} /></section>
    <section className={editorial.section}><div className={editorial.sectionHead}><div><p className={editorial.eyebrow}>Beyond the city</p><h2>Explore routes and starting prices</h2><p>Published route estimates. Add your pickup, drop and schedule to see the applicable charges for your trip.</p></div><Link href="/price-calculator" className="btn btn-secondary">Plan another route</Link></div>
      <HorizontalScroll label="Published routes" controls="above"><div className={`${editorial.grid} ${editorial.packageRail}`}>{citiesData.flatMap((row) => row.fares.slice(0, 2).map((fare) => ({...fare, cityName: row.name}))).slice(0, 12).map((fare) => <article className={editorial.card} key={`${fare.fromSlug}-${fare.toSlug}`}><span className={editorial.number}>{fare.cityName} / {fare.km} km</span><h3>{fare.name}</h3><p>Round trip estimate</p><div className={editorial.price}>{formatINR(fare.price)}</div><span className={editorial.unit}>Starting from</span><Link href={`/price-calculator?from=${fare.fromSlug}&to=${fare.toSlug}&pkg=${fare.packageSlug}&trip=round`} className="btn btn-secondary mt-6">Price this route <Icon name="ph-arrow-up-right" size={16} /></Link></article>)}</div></HorizontalScroll>
    </section>
    <section className={editorial.section}><ChargesExplained settings={catalog.settings} /></section>
    <section className={editorial.section}><EditorialCTA title="Your route starts with an idea." description="Choose a car and share your itinerary. Our team will confirm the details and availability." /></section>
  </div>;
}
