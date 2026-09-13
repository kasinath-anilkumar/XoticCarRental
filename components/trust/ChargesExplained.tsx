import { Icon } from "@/components/ui/Icon";
import { formatChargePolicy, formatINR } from "@/lib/format";
import { nightWindowLabel } from "@/lib/pricing";
import type { Car, SiteSettings } from "@/lib/types";
import styles from "@/components/content/Editorial.module.css";


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
  heading = "How your estimate is calculated",
  kicker = "Pricing explained",
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
        ? `${formatINR(car.nightCharge)} for a pickup between ${nightWindowLabel(settings.pricingRules)}, plus one charge for each overnight rental halt.`
        : `Applies to pickups between ${nightWindowLabel(settings.pricingRules)}, plus one charge for each overnight rental halt.`,
    },
    {
      icon: "ph-arrow-u-down-left",
      title: "Garage travel",
      body: "The distance includes the garage to your pickup, your journey, and the final drop back to the garage. Return kilometres are counted once, including on one-way bookings.",
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
      body: formatChargePolicy(settings),
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

      <div className={styles.grid}>
        {charges.map((charge) => (
          <div
            key={charge.title}
            className={styles.card}
          >
            <Icon name={charge.icon} size={20} color="var(--color-accent)" />
            <h3 className="mt-5!">
              {charge.title}
            </h3>
            <p className="m-0 text-[13px] text-[var(--color-neutral-400)] [text-wrap:pretty]">
              {charge.body}
            </p>
          </div>
        ))}
      </div>

      <p className={styles.note}>
        GST at {settings.gstPercent}% applies to the quoted charges. Final pricing and availability require confirmation.
      </p>
    </div>
  );
}
