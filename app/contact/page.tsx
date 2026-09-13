import type { Metadata } from "next";
import Link from "next/link";
import { EditorialIntro, editorial } from "@/components/content/Editorial";
import { ServiceEnquiryForm } from "@/components/services/ServiceEnquiryForm";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import { Icon } from "@/components/ui/Icon";
import { getCatalog } from "@/lib/content";
import { getService, getServicePage } from "@/lib/service-content";
import { siteUrl } from "@/lib/site";
import { GENERAL_ENQUIRY_MESSAGE, whatsappLink } from "@/lib/whatsapp";
import styles from "./page.module.css";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Contact", description: "Call, WhatsApp or share your plans with the Xotic team through a service enquiry.", alternates: { canonical: "/contact" }, openGraph: { url: `${siteUrl()}/contact` } };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const params = await searchParams;
  const [catalog, choices, service] = await Promise.all([getCatalog(), getServicePage(1, 100), params.service ? getService(params.service) : undefined]);
  const serviceChoices = service && !choices.data.some((item) => item.slug === service.slug) ? [service, ...choices.data] : choices.data;
  const wa = whatsappLink(catalog.settings.whatsappNumber, GENERAL_ENQUIRY_MESSAGE);
  const tel = `tel:${catalog.settings.phoneDisplay.replace(/[^\d+]/g, "")}`;
  const selector = <form className={styles.selector} action="/contact#contact-enquiry"><p className={editorial.eyebrow}>Plan with us</p><h2>What can we help with?</h2><p>Choose a service to share the details for your trip.</p><div className="field"><label htmlFor="contact-service">Choose a service</label><select className="input" id="contact-service" name="service" required defaultValue={service?.slug ?? ""}><option value="" disabled>Choose a service</option>{serviceChoices.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></div><button className="btn btn-primary" type="submit">Continue <Icon name="ph-arrow-right" size={17} /></button>{choices.total > choices.data.length && <Link href="/services" className="block text-sm">Browse all services</Link>}</form>;
  return <div className={editorial.page}>
    <EditorialIntro eyebrow="Contact" title="Let’s talk about your journey." mobileTitle="Talk to our team" description="A date, a destination, or just an idea. Share what you have in mind and our team will help with the details." />
    <section className={`${editorial.section} ${styles.content}`}><div className={`${editorial.twoColumns} ${editorial.enquiryLayout}`}>
      <div><h2 className={styles.heading}>A conversation starts here.</h2><div className={styles.channels}>
        <a href={tel}><Icon name="ph-phone-call" size={25} /><span><small>Call us</small><strong>{catalog.settings.phoneDisplay}</strong></span><Icon name="ph-arrow-up-right" size={18} /></a>
        <a href={wa} target="_blank" rel="noopener noreferrer"><Icon name="ph-whatsapp-logo" size={25} /><span><small>WhatsApp</small><strong>Message our team</strong></span><Icon name="ph-arrow-up-right" size={18} /></a>
        <a href={`mailto:${catalog.settings.email}`}><Icon name="ph-envelope-simple" size={25} /><span><small>Email</small><strong>{catalog.settings.email}</strong></span><Icon name="ph-arrow-up-right" size={18} /></a>
      </div><ResponsiveDisclosure title="Our service cities" className={styles.locations} hideTitleOnDesktop><h3 className={editorial.secondaryHeading}>Find us along your route.</h3><p>Explore our service cities and the cars available to enquire about in each location.</p><div className={editorial.pillList}>{catalog.cities.slice(0, 12).map((city) => <Link key={city.slug} href={`/cities/${city.slug}`} prefetch={false}>{city.name}</Link>)}</div>{catalog.cities.length > 12 && <Link href="/cities" className="mt-4 inline-block">Browse all cities</Link>}</ResponsiveDisclosure></div>
      <div id="contact-enquiry" tabIndex={-1} className={editorial.enquiryTarget}>{service ? <><ResponsiveDisclosure title={`Change service: ${service.short}`} hideTitleOnDesktop>{selector}</ResponsiveDisclosure><ServiceEnquiryForm service={service} /></> : selector}</div>
    </div></section>
  </div>;
}
