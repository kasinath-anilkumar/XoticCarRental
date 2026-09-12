import type { Metadata } from "next";
import Link from "next/link";

import { ServiceEnquiryForm } from "@/components/services/ServiceEnquiryForm";
import { Icon } from "@/components/ui/Icon";
import { getCatalog } from "@/lib/content";
import { serviceBySlug } from "@/lib/services";
import { siteUrl } from "@/lib/site";
import { GENERAL_ENQUIRY_MESSAGE, whatsappLink } from "@/lib/whatsapp";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Call, WhatsApp or send an enquiry. Every message gets a reference and a callback the same day.",
  alternates: { canonical: "/contact" },
  openGraph: { url: `${siteUrl()}/contact` },
};

/**
 * Contact (§26).
 *
 * Three ways to reach Xotic, in the order people actually use them from a
 * phone: call, WhatsApp, then a form for anyone who would rather write it out.
 * The form is the leisure service's — a general enquiry is a trip, and asking
 * where and when is what makes it answerable in one reply instead of four.
 */
export default async function ContactPage() {
  const catalog = await getCatalog();
  const service = serviceBySlug("leisure");
  const wa = whatsappLink(catalog.settings.whatsappNumber, GENERAL_ENQUIRY_MESSAGE);
  const tel = `tel:${catalog.settings.phoneDisplay.replace(/[^\d+]/g, "")}`;

  return (
    <section className="sec">
      <p className="kick">Contact</p>
      <h1 className="mb-1 font-[family-name:var(--font-heading)] text-[32px] leading-tight sm:text-[38px]">
        Talk to someone who knows the fleet
      </h1>
      <p className="mb-7 max-w-[62ch] text-sm text-[var(--color-neutral-400)]">
        Calls are answered by the people who dispatch the cars, not a call centre. Every enquiry gets
        a reference the moment it arrives and a callback the same day.
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <a
              href={tel}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-4 no-underline"
            >
              <Icon name="ph-phone-call" size={22} color="var(--color-accent)" />
              <span>
                <span className="block text-[13px] text-[var(--color-neutral-400)]">Call us</span>
                <span className="block font-[family-name:var(--font-heading)] text-[19px] text-[var(--color-text)]">
                  {catalog.settings.phoneDisplay}
                </span>
              </span>
            </a>

            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-4 no-underline"
            >
              <Icon name="ph-whatsapp-logo" size={22} color="#25d366" />
              <span>
                <span className="block text-[13px] text-[var(--color-neutral-400)]">WhatsApp</span>
                <span className="block font-[family-name:var(--font-heading)] text-[19px] text-[var(--color-text)]">
                  Message us
                </span>
              </span>
            </a>

            <a
              href={`mailto:${catalog.settings.email}`}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-4 no-underline"
            >
              <Icon name="ph-envelope-simple" size={22} color="var(--color-accent)" />
              <span>
                <span className="block text-[13px] text-[var(--color-neutral-400)]">Email</span>
                <span className="block font-[family-name:var(--font-heading)] text-[17px] break-all text-[var(--color-text)]">
                  {catalog.settings.email}
                </span>
              </span>
            </a>
          </div>

          <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-5">
            <h2 className="font-[family-name:var(--font-heading)] text-[17px]">Where the cars are</h2>
            <p className="mt-1 mb-3 text-[13px] text-[var(--color-neutral-400)]">
              We dispatch from yards in each city we serve. The nearest one to you is chosen when we
              quote — it is what the distance is measured from.
            </p>
            <div className="flex flex-wrap gap-2">
              {catalog.cities.map((city) => (
                <Link
                  key={city.slug}
                  href={`/cities/${city.slug}`}
                  className="rounded-full border border-[var(--color-divider)] px-3 py-1 text-[12px] text-[var(--color-text)] no-underline hover:border-[var(--color-accent-solid)]"
                >
                  {city.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div>{service && <ServiceEnquiryForm service={service} />}</div>
      </div>
    </section>
  );
}
