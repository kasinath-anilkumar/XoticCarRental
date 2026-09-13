import type { Metadata } from "next";
import Link from "next/link";
import { ServiceCard } from "@/components/cards/ServiceCard";
import { EditorialIntro, EditorialCTA, editorial } from "@/components/content/Editorial";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { Pagination } from "@/components/ui/Pagination";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { SERVICE_GROUPS } from "@/lib/services";
import { getServicePage } from "@/lib/service-content";
import { parsePage } from "@/lib/pagination";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "What we drive for",
  description: "Explore chauffeur services, published packages and cars for your journey across our service locations.",
  alternates: { canonical: "/services" }, openGraph: { url: `${siteUrl()}/services` },
};

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const [catalog, servicePage] = await Promise.all([getCatalog(), getServicePage(parsePage(params.page))]);
  const services = servicePage.data;
  if (!isPricingAvailable(catalog)) return <section className="sec"><h1 className="mb-6">Services with a chauffeur</h1><PricingUnavailable /><nav aria-label="Services" className="mt-6 flex flex-wrap gap-3">{services.map((service) => <Link key={service.slug} href={`/services/${service.slug}`} className="btn btn-secondary">{service.short}</Link>)}</nav></section>;
  const heroFor = (slug: string) => catalog.occasions.find((occasion) => occasion.slug === slug)?.heroImage ?? null;
  return <div className={editorial.page}>
    <EditorialIntro eyebrow="Our services" title="Chauffeur services for your plans" description="Airport pickups, celebrations and trips out of town. Compare our services and packages, then choose a car for your journey." image={heroFor(services[0]?.occasionSlug ?? "")} imageLabel="Explore our chauffeur services" actions={<><Link href="#services" className="btn btn-primary">Find your service</Link><Link href="/cars" className="btn btn-secondary">View cars</Link></>} />
    <div id="services">{SERVICE_GROUPS.map((group) => {
      const grouped = services.filter((service) => service.group === group.key);
      if (!grouped.length) return null;
      return <section key={group.key} className={editorial.section}><div className={editorial.sectionHead}><div><p className={editorial.eyebrow}>Made for your plans</p><h2>{group.name}</h2><p>{group.blurb}</p></div></div><div className={editorial.grid}>{grouped.map((service) => <ServiceCard key={service.slug} service={service} image={heroFor(service.occasionSlug)} />)}</div></section>;
    })}</div>
    <div className={editorial.section}><Pagination total={servicePage.total} page={servicePage.page} pageSize={24} path="/services" label="services" /><EditorialCTA title="Tell us where you want to go." description="Start with a car, a date and a route. Explore an estimate or talk through the details with our team." href="/contact" action="Talk about your plans" /></div>
  </div>;
}
