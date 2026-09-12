import { Icon } from "@/components/ui/Icon";
import { formatINR } from "@/lib/format";
import type { Car, SiteSettings } from "@/lib/types";


export interface ChargesExplainedProps {
  settings: SiteSettings;
  /** When given, every rule is stated with this car's real figures. */
  car?: Car;
  /** Null when the page supplies its own heading above the grid. */
  heading?: string | null;
  kicker?: string | null;
}

/**
 * What can and cannot move the price.
 *
 * These six are exactly the charges Indian customers have been caught by
 * before — the driver's daily allowance, the night pickup, the empty run home
 * after a one-way drop — and no competitor explains them: they either claim
 * "all inclusive" or bury a terse line in terms and conditions.
 *
 * Every rule here is the rule lib/pricing.ts actually implements, so this is a
 * description of the engine rather than marketing copy that could drift from
 * it. Rendered on the home page, the calculator, car detail and city pages: a
 * policy that reads identically everywhere reads as a policy.
 */
export function ChargesExplained({
  settings,
  car,
  heading = "Nothing appears on your bill that is not on this page",
  kicker = "No surprises",
}: ChargesExplainedProps) {
  const charges = [
    {
      icon: "ph-user-circle-check",
      title: "Driver bata",
      body: car
        ? `${formatINR(car.bata)} a day — his food and stay. Charged per day of the trip, not per hour, and it is on every quote.`
        : "The chauffeur's food and stay. Charged per day of the trip, not per hour, and it is on every quote.",
    },
    {
      icon: "ph-moon-stars",
      title: "Night charge",
      body: car
        ? `${formatINR(car.nightCharge)}, and only when your pickup falls between 10pm and 6am. A 9pm pickup that runs past midnight does not attract it.`
        : "Applies only when your pickup falls between 10pm and 6am. A 9pm pickup that runs past midnight does not attract it.",
    },
    {
      icon: "ph-arrow-u-down-left",
      title: "One-way drops",
      body: "The chauffeur has to bring the car back empty, so a one-way drop adds 35% of the distance at the extra-km rate — not a second full package.",
    },
    {
      icon: "ph-road-horizon",
      title: "Extra distance",
      body: car
        ? `${formatINR(car.extraKmRate)} per km past the km your package includes. The calculator shows the figure before you send anything.`
        : "Charged per km past the km your package includes. The calculator shows the figure before you send anything.",
    },
    {
      icon: "ph-timer",
      title: "Extra hours",
      body: car
        ? `${formatINR(car.extraHrRate)} per hour past the package allowance, billed to the half hour.`
        : "Charged per hour past the package allowance, billed to the half hour.",
    },
    {
      icon: "ph-receipt",
      title: "Tolls, parking, permits",
      body: "At actuals on the day, with receipts. They are not in the quote because they depend on the exact roads you take.",
    },
  ];

  return (
    <div>
      {kicker && <p className="kick">{kicker}</p>}
      {heading && (
        <h2 className="h2" style={{ marginBottom: "22.4px" }}>
          {heading}
        </h2>
      )}

      <div className="grid grid-cols-[repeat(3,1fr)] gap-8 max-lg:grid-cols-[repeat(2,1fr)] max-lg:gap-4 max-md:grid-cols-1 max-md:gap-3">
        {charges.map((charge) => (
          <div
            key={charge.title}
            className="rounded-md bg-surface p-6 shadow-[var(--shadow-sm)] max-md:px-[14px] max-md:py-4"
          >
            <Icon name={charge.icon} size={20} color="var(--color-accent)" />
            <p className="mt-3 mb-[4px] font-[family-name:var(--font-heading)] text-[15px]">
              {charge.title}
            </p>
            <p className="m-0 text-[13px] text-[var(--color-neutral-400)] [text-wrap:pretty]">
              {charge.body}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 mb-0 text-[13px] text-[var(--color-neutral-300)]">
        GST at {settings.gstPercent}% applies to the total. There is nothing else.
      </p>
    </div>
  );
}
