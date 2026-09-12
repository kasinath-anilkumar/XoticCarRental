import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { getCatalog } from "@/lib/content";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Xotic",
  description:
    "Who Xotic is, where we operate, and how a chauffeur-driven booking actually works from enquiry to invoice.",
  alternates: { canonical: "/about" },
  openGraph: { url: `${siteUrl()}/about` },
};

const PRINCIPLES = [
  {
    icon: "ph-receipt",
    title: "The price is the price",
    detail:
      "Every charge is a line: the package, the driver's allowance, extra kilometres, the night charge, the tax. Nothing appears at the end of a trip that was not on the estimate at the start of it.",
  },
  {
    icon: "ph-map-pin-line",
    title: "Distance measured from the yard",
    detail:
      "A car has to leave a garage to reach you and return to one afterwards. We count that, and we show it — a quote that pretends the car materialises at your door is a quote that gets corrected later.",
  },
  {
    icon: "ph-user-focus",
    title: "Chauffeur arrangements confirmed",
    detail:
      "Tell us your timings and requirements. Our team confirms the chauffeur arrangements and any special requests with your booking.",
  },
  {
    icon: "ph-clock-countdown",
    title: "An enquiry you can track",
    detail:
      "Every saved enquiry gets a reference for follow-up. The reason the whole site is built around lead references is that a message lost in a WhatsApp thread is a customer lost with it.",
  },
];

export default async function AboutPage() {
  const catalog = await getCatalog();
  const states = [...new Set(catalog.cities.map((city) => city.state))];

  return (
    <>
      <section className="sec">
        <p className="kick">About Xotic</p>
        <h1 className="mb-3 max-w-[20ch] font-[family-name:var(--font-heading)] text-[32px] leading-tight sm:text-[40px]">
          A luxury car company that answers the phone
        </h1>
        <p className="max-w-[68ch] text-[15px] text-[var(--color-neutral-400)]">
          Xotic runs chauffeur-driven luxury cars for weddings, shoots, corporate travel, airport
          runs and long tours. Browse the published fleet and service locations, compare package
          rates, and share your itinerary for a confirmed quote.
        </p>
      </section>

      <section className="sec">
        <h2 className="h2 mb-5">How we work</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((item) => (
            <div
              key={item.title}
              className="rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-5"
            >
              <Icon name={item.icon} size={22} color="var(--color-accent)" />
              <h3 className="mt-2 font-[family-name:var(--font-heading)] text-[18px]">
                {item.title}
              </h3>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-400)]">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <h2 className="h2 mb-1">Where we operate</h2>
        <p className="mb-5 max-w-[62ch] text-sm text-[var(--color-neutral-400)]">
          The service area is {states.join(", ")}. Cars cross state lines on one booking, with the
          permits paid and the same driver throughout — a tour does not change hands at a border.
        </p>
        <div className="flex flex-wrap gap-2">
          {catalog.cities.map((city) => (
            <Link
              key={city.slug}
              href={`/cities/${city.slug}`}
              className="rounded-full border border-[var(--color-divider)] px-3 py-1.5 text-[13px] text-[var(--color-text)] no-underline hover:border-[var(--color-accent-solid)]"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="sec">
        <h2 className="h2 mb-5">What happens after you enquire</h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["You send the details", "Through the form or on WhatsApp. You get a reference immediately."],
            ["We check the real fleet", "Which cars are free on your date, and which yard is nearest to you."],
            ["You get a firm rate", "The estimate, corrected for the actual car and the actual route."],
            ["You confirm", "An advance holds the vehicle. The balance is due on the day."],
          ].map(([title, detail], index) => (
            <li
              key={title}
              className="rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-4"
            >
              <span className="font-[family-name:var(--font-heading)] text-[13px] text-[var(--color-accent)]">
                Step {index + 1}
              </span>
              <p className="mt-1 text-[15px] font-medium">{title}</p>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-400)]">{detail}</p>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-wrap gap-2">
          <Link href="/price-calculator" className="btn btn-primary">
            <Icon name="ph-calculator" size={17} />
            Price a trip
          </Link>
          <Link href="/contact" className="btn btn-ghost">
            <Icon name="ph-phone-call" size={17} />
            Talk to someone
          </Link>
        </div>
      </section>
    </>
  );
}
