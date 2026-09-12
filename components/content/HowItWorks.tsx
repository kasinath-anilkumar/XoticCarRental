import { Icon } from "@/components/ui/Icon";
import type { SiteSettings } from "@/lib/types";


/**
 * How a booking actually works.
 *
 * The site takes no payment, so there is no checkout to reassure anybody — this
 * has to do that job instead. Every Indian operator ships some version of
 * "enquire, confirm, travel", and every one of them stops before the money,
 * which is the question actually holding someone back: what do I pay, when, and
 * what do I get for it.
 *
 * The percentages are read from settings rather than written into the copy, so
 * this can never claim a figure the quote engine does not use.
 */
export function HowItWorks({ settings }: { settings: SiteSettings }) {
  const steps = [
    {
      title: "Price it here",
      body: "Pick the car and the package and see the whole itemised price. No form, no login, no account.",
      artefact: null,
    },
    {
      title: "Send it on WhatsApp",
      body: "The message carries the full breakdown, so you and we are looking at the same numbers from the first reply.",
      artefact: null,
    },
    {
      title: `Pay ${settings.advancePercent}% to hold the date`,
      body: "Only once the car and the driver are confirmed. Nothing is charged on this site, and no payment happens inside the chat.",
      artefact: { icon: "ph-receipt", label: `GST ${settings.gstPercent}% invoice` },
    },
    {
      title: "Balance after the trip",
      body: "Itemised the same way, with any extra km and hours at the rates you already saw here.",
      artefact: { icon: "ph-wallet", label: "Same line items" },
    },
  ];

  return (
    <>
      <p className="kick">How it works</p>
      <h2 className="h2" style={{ marginBottom: "22.4px" }}>
        From this page to a confirmed car
      </h2>

      <div className="grid grid-cols-[repeat(4,1fr)] gap-8 max-lg:grid-cols-[repeat(2,1fr)] max-lg:gap-6 max-md:grid-cols-1">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="relative pt-[4px] not-last:after:absolute not-last:after:top-[22px] not-last:after:-right-4 not-last:after:h-px not-last:after:w-8 not-last:after:bg-[var(--color-divider)] not-last:after:content-[''] max-lg:after:hidden"
          >
            <span className="font-[family-name:var(--font-heading)] text-[42px] leading-none font-extralight tabular-nums text-[var(--color-neutral-400)] max-md:text-[32px]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="mt-4 mb-[4px] font-[family-name:var(--font-heading)] text-[17px]">
              {step.title}
            </p>
            <p className="m-0 text-[13px] text-[var(--color-neutral-500)] [text-wrap:pretty]">
              {step.body}
            </p>
            {step.artefact && (
              <span className="mt-3 inline-flex items-center gap-[5px] text-[11px] text-accent-text">
                <Icon name={step.artefact.icon} size={13} />
                {step.artefact.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
