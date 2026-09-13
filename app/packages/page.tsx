import type { Metadata } from "next";
import Link from "next/link";
import { EditorialIntro, EditorialCTA, editorial } from "@/components/content/Editorial";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { getServicePage } from "@/lib/service-content";
import { parsePage } from "@/lib/pagination";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Packages", description: "Compare published chauffeur service packages, what they cover and where prices start.", alternates: { canonical: "/packages" }, openGraph: { url: `${siteUrl()}/packages` } };

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const [catalog, servicePage] = await Promise.all([getCatalog(), getServicePage(parsePage(params.page), 6)]);
  const services = servicePage.data;
  if (!isPricingAvailable(catalog)) return <section className="sec"><h1 className="mb-6">Packages for your journey</h1><PricingUnavailable /></section>;
  return <div className={editorial.page}>
    <EditorialIntro eyebrow="Packages" title="Compare car rental packages" description="Check included hours, distance and services. Find a package for your plans, then confirm the price for your car, dates and route." image={catalog.occasions.find((occasion) => occasion.heroImage)?.heroImage ?? null} imageLabel="Plan around your occasion" actions={<Link href="#packages" className="btn btn-primary">View packages</Link>} />
    <nav aria-label="Jump to a service" className={editorial.contextNav}><HorizontalScroll label="Package services" contentClassName={editorial.pillList}>{services.map((service) => <a key={service.slug} href={`#${service.slug}`} className="shrink-0 whitespace-nowrap">{service.short}</a>)}</HorizontalScroll></nav>
    <div id="packages" tabIndex={-1} className={editorial.enquiryTarget}>{services.map((service) => <section key={service.slug} id={service.slug} className={`${editorial.section} scroll-mt-[calc(var(--header-height)+16px)]`}><div className={editorial.sectionHead}><div><p className={editorial.eyebrow}>{service.short}</p><h2>{service.name}</h2><p>{service.tagline}</p></div><Link href={`/services/${service.slug}`} className="btn btn-secondary">What it includes <Icon name="ph-arrow-up-right" size={16} /></Link></div><HorizontalScroll label={`${service.short} packages`} controls="above"><div className={`${editorial.grid} ${editorial.packageRail}`}>{service.packages.map((item, index) => <article key={item.name} className={`${editorial.card} flex flex-col`}><span className={editorial.number}>{String(index + 1).padStart(2, "0")}</span><h3>{item.name}</h3><p className="flex-1">{item.detail}</p><div className={editorial.price}>{item.price}</div><span className={editorial.unit}>{item.unit}</span><Link href={`/services/${service.slug}#enquiry`} className="btn btn-secondary mt-7">Enquire <Icon name="ph-arrow-up-right" size={16} /></Link></article>)}</div></HorizontalScroll></section>)}</div>
    <section className={editorial.section}><p className={editorial.note}>Prices are starting points. Unless a package says “all in”, {catalog.settings.gstPercent}% GST is additional. Confirm the final quote and availability with our team.</p><Pagination total={servicePage.total} page={servicePage.page} pageSize={6} path="/packages" targetId="packages" label="services" /><EditorialCTA title="Have a different journey in mind?" description="Build an estimate around your own route or tell us what you need." action="Price your own route" /></section>
  </div>;
}
