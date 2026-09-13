import type { Metadata } from "next";
import Link from "next/link";
import { EditorialIntro, EditorialCTA, editorial } from "@/components/content/Editorial";
import { HowItWorks } from "@/components/content/HowItWorks";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import { getCatalog } from "@/lib/content";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;
export const metadata: Metadata = { title: "About Xotic", description: "Explore Xotic chauffeur services, our fleet and how a booking works.", alternates: { canonical: "/about" }, openGraph: { url: `${siteUrl()}/about` } };

const PRINCIPLES = [
  { title: "Know what goes into the price", detail: "See the package, chauffeur allowance, distance, time and tax as separate lines in your estimate. Review the details with our team before you confirm." },
  { title: "A route that starts with the car", detail: "Your estimate includes the journey from the garage to your pickup and the return journey. The distance breakdown shows how it is calculated." },
  { title: "Your plans shape the booking", detail: "Share your timings, itinerary and any special requests. Our team confirms the car and chauffeur arrangements with your booking." },
  { title: "Keep the conversation together", detail: "Each saved enquiry has a reference for follow-up. The prepared WhatsApp message carries your trip details into the conversation." },
];

export default async function AboutPage() {
  const catalog = await getCatalog();
  return <div className={editorial.page}>
    <EditorialIntro eyebrow="About Xotic" title="Your car. Your plans. Our chauffeur." description="Choose a chauffeur-driven car, compare the details and share your route. Our team helps you confirm the vehicle and arrangements for your trip." image={catalog.cars[0]?.images[0]?.url ?? catalog.cities[0]?.heroImage ?? null} imageLabel="A closer look at the Xotic fleet" actions={<Link href="/cars" className="btn btn-primary">View cars</Link>} />
    <section className={editorial.section}><ResponsiveDisclosure title="How we plan your journey" hideTitleOnDesktop><div className={`${editorial.sectionHead} ${editorial.secondaryHeading}`}><div><p className={editorial.eyebrow}>Our approach</p><h2>Thoughtful planning, from the first detail.</h2></div></div><div className={editorial.twoColumns}>{PRINCIPLES.map((item, index) => <article className={editorial.card} key={item.title}><span className={editorial.number}>{String(index + 1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.detail}</p></article>)}</div></ResponsiveDisclosure></section>
    <section className={editorial.section}><HowItWorks settings={catalog.settings} /></section>
    <section className={editorial.section}><div className={editorial.sectionHead}><div><p className={editorial.eyebrow}>Where we drive</p><h2>Find your starting point.</h2><p>Explore our service cities, local fleet and route estimates. Confirm your itinerary and travel requirements with the team.</p></div><Link href="/cities" className="btn btn-secondary">Explore all cities</Link></div><div className={editorial.pillList}>{catalog.cities.map((city) => <Link href={`/cities/${city.slug}`} key={city.slug}>{city.name}</Link>)}</div></section>
    <section className={editorial.section}><EditorialCTA href="/contact" action="Start a conversation" title="A journey worth planning." description="Tell us what you have in mind. We will help you work through the car, the route and the details." /></section>
  </div>;
}
