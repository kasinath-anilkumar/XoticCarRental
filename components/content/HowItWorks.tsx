import type { SiteSettings } from "@/lib/types";
import styles from "./HowItWorks.module.css";

export function HowItWorks({ settings }: { settings: SiteSettings }) {
  const steps = [
    { title: "Choose your car", body: "Choose a car, your route and a package. See the estimated price with each charge explained." },
    { title: "Share your plans", body: "Send your enquiry on WhatsApp with the trip details and price breakdown already prepared." },
    { title: "Confirm your booking", body: `Our team checks availability and payment arrangements. The booking advance is ${settings.advancePercent}%. Keep your booking details handy; additional distance and time use your car’s published rates.` },
  ];
  return <><div className={styles.heading}><p className={styles.eyebrow}>How it works</p><h2>Book your chauffeur in three steps</h2></div><ol className={styles.steps}>{steps.map((step, index) => <li className={styles.step} key={step.title}><span className={styles.marker} aria-hidden="true">{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol></>;
}
