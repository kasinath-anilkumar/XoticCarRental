import { Icon } from "@/components/ui/Icon";
import type { ResolvedQuote } from "@/lib/quote";
import styles from "./RouteDistanceBreakdown.module.css";

/** The billed journey includes empty vehicle travel as well as passenger stops. */
export function RouteDistanceBreakdown({ resolved }: { resolved: ResolvedQuote }) {
  if (!resolved.complete) return null;
  const places = new Map(resolved.stops.map((stop) => [stop.key, stop.name]));
  const label = (key: string) => places.get(key) ?? "Journey stop";
  const numberFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
  const kilometres = (value: number) => `${numberFormat.format(value)} km`;

  return <section className={styles.section} aria-label="Distance breakdown">
    <header className={styles.header}>
      <div><p className={styles.kicker}>The full vehicle journey</p><h3>Distance breakdown</h3></div>
      <Icon name="ph-path" size={24} />
    </header>
    <ol className={styles.legs}>
      {resolved.legs.map((leg, index) => <li key={`${index}-${leg.fromSlug}-${leg.toSlug}`}>
        <span className={styles.number} aria-hidden="true">{index + 1}</span>
        <div className={styles.places}>
          <span>{leg.transfer && index === 0 ? "Garage" : label(leg.fromSlug)} <span className={styles.arrow} aria-hidden="true">→</span><span className="visually-hidden"> to </span> {leg.transfer && index === resolved.legs.length - 1 ? "Garage" : label(leg.toSlug)}</span>
          {leg.transfer && <small>{index === 0 ? "Vehicle travels to your pickup" : "Vehicle returns after your drop"}</small>}
        </div>
        <span className={styles.distance}>{kilometres(leg.km)}</span>
      </li>)}
    </ol>
    <div className={styles.total}><span>Total billable distance</span><strong>{kilometres(resolved.quote.km)}</strong></div>
    <p className={styles.note}>{resolved.routed ? "Uses road-route distances, with any published distances and minimum billing rules applied." : "Estimated road distances. They update when a driving route is available."} Garage travel is included once.</p>
  </section>;
}
