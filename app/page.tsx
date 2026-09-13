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
import { Media } from "@/components/ui/Media";
import { Reveal } from "@/components/ui/Reveal";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { featuredCars, tripDefaults } from "@/lib/catalog";
import { businessDate } from "@/lib/dates";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { getCatalog } from "@/lib/content";
import { getHeroFrames } from "@/lib/hero-frames";
import { getServicePage } from "@/lib/service-content";
import styles from "@/components/home/Home.module.css";

export const revalidate = 3600;

export default async function HomePage() {
  const [catalog, heroFrames, services] = await Promise.all([getCatalog(), getHeroFrames(), getServicePage(1, 4)]);
  const pricingAvailable = isPricingAvailable(catalog);
  const seedTrip = tripDefaults(catalog, "");
  const defaultPackage = catalog.packages[0];
  const featured = featuredCars(catalog).slice(0, 3);

  return (
    <>
      <ScrollHero frames={heroFrames} />

      <div id="journey-search" tabIndex={-1} className={styles.journeySearch}>
        {pricingAvailable ? <HomeSearch
          locations={catalog.locations}
          cities={catalog.cities.map(({ slug, name, state }) => ({ slug, name, state }))}
          packages={catalog.packages.map(({ slug, label, sub }) => ({ slug, label, sub }))}
          defaults={{ from: "", date: "", packageSlug: seedTrip.packageSlug }}
          minDate={businessDate()}
        /> : <PricingUnavailable />}
      </div>

      {pricingAvailable && <div className={styles.proof} aria-label="Explore Xotic">
        <div><Icon name="ph-car" size={24} /><span><strong>{catalog.cars.length} vehicles to explore</strong><small>Compare cars and package rates</small></span></div>
        <div><Icon name="ph-map-pin" size={24} /><span><strong>{catalog.cities.length} service cities</strong><small>Find your local starting point</small></span></div>
        <div><Icon name="ph-steering-wheel" size={24} /><span><strong>Travel with a chauffeur</strong><small>Plan the trip. Enjoy the journey.</small></span></div>
      </div>}

      {pricingAvailable && featured.length > 0 && <section className="sec">
        <Reveal className="sec-head">
          <div><p className="kick">Explore the fleet</p><h2 className="h2">Find your next ride</h2></div>
          <div className={styles.sectionAside}><p>Compare vehicles, seats and package rates.</p><Link href="/cars" className={styles.textLink}>Browse all cars <Icon name="ph-arrow-up-right" size={18} /></Link></div>
        </Reveal>
        <HorizontalScroll label="Featured cars" controls="above" contentClassName={styles.featured}>{featured.map((car) => <CarCard key={car.slug} catalog={catalog} car={car} pkg={defaultPackage} />)}</HorizontalScroll>
      </section>}

      {services.data.length > 0 && <section className={`sec ${styles.occasions}`}>
        <Reveal className="sec-head">
          <div><p className="kick">Choose your journey</p><h2 className="h2">A ride for every plan</h2></div>
          <Link href="/services" className={styles.textLink}>Explore all {services.total} services <Icon name="ph-arrow-up-right" size={18} /></Link>
        </Reveal>
        <div className={styles.services}>{services.data.map((service) => <ServiceCard
          key={service.slug} service={service}
          image={catalog.occasions.find((occasion) => occasion.slug === service.occasionSlug)?.heroImage ?? null}
        />)}</div>
      </section>}

      <ResponsiveDisclosure title="About Xotic" className={styles.story} contentClassName={styles.storyContent} hideTitleOnDesktop>
        <Reveal className={styles.storyImage}><Media src="/brand/xotic_hero.png" alt="Wedding cars outside a palm-lined resort at sunset" placeholder="The Xotic journey" sizes="(max-width: 767px) 100vw, 58vw" className={styles.storyMedia} /></Reveal>
        <div className={styles.storyCopy}>
          <p className="kick">The journey is part of the occasion</p>
          <h2 id="home-story-title">You make the plans.<br />We’ll take the wheel.</h2>
          <p>From an airport pickup to a wedding arrival, find a car that suits the occasion. Build your route, review the estimate and confirm the details with our team.</p>
          <Link href="/about" className={styles.textLink}>Discover Xotic <Icon name="ph-arrow-up-right" size={18} /></Link>
        </div>
      </ResponsiveDisclosure>

      {catalog.cities.length > 0 && <section className={`sec ${styles.destinations}`}>
        <Reveal className="sec-head">
          <div><p className="kick">Start closer to home</p><h2 className="h2">Explore cars by city</h2></div>
          <Link href="/cities" className={styles.textLink}>Explore all {catalog.cities.length} cities <Icon name="ph-arrow-up-right" size={18} /></Link>
        </Reveal>
        <div className={styles.cities}>{catalog.cities.slice(0, 6).map((city) => <CityCard key={city.slug} city={city} />)}</div>
        <p className={styles.coverage}><Icon name="ph-map-pin" size={18} /> Discover local fleets, package rates, and journeys beyond the city.</p>
      </section>}

      <section className="sec"><HowItWorks settings={catalog.settings} /></section>

      {pricingAvailable && <section className={`sec ${styles.pricing}`}><ResponsiveDisclosure title="Explore package pricing" id="home-pricing" hideTitleOnDesktop><LivePricing catalog={catalog} initialTrip={seedTrip} /></ResponsiveDisclosure></section>}

      {pricingAvailable && <section className="sec">
        <ResponsiveDisclosure title="Browse by vehicle type" id="home-fleet" hideTitleOnDesktop>
        <Reveal className={`sec-head ${styles.disclosureHead}`}>
          <div><p className="kick">More choice, less searching</p><h2 className={`h2 ${styles.fleetHeading}`}>Browse by vehicle type</h2></div>
          <Link href="/cars" className="btn btn-secondary">Browse all vehicles <Icon name="ph-arrow-up-right" size={17} /></Link>
        </Reveal>
        <WholeFleet catalog={catalog} defaultPackage={defaultPackage} />
        </ResponsiveDisclosure>
      </section>}

      {catalog.settings.whyItems.length > 0 && <section className={`sec ${styles.why}`}>
        <ResponsiveDisclosure title="Why choose Xotic" hideTitleOnDesktop>
        <Reveal className={`sec-head ${styles.disclosureHead}`}><div><p className="kick">The details matter</p><h2 className="h2">Thoughtfully planned.<br /><em className={styles.serif}>From start to arrival.</em></h2></div></Reveal>
        <div className={styles.promises}>{catalog.settings.whyItems.map((item) => <div key={item.title}>
          <Icon name={item.icon} size={25} /><h3>{item.title}</h3><p>{item.body}</p>
        </div>)}</div>
        </ResponsiveDisclosure>
      </section>}
    </>
  );
}
