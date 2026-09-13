import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./JourneyRoadmap.module.css";

export interface JourneyRoadmapStep {
  label: string;
  href?: string;
  complete?: boolean;
  current?: boolean;
}

/** Section shortcuts describe progress without hiding any part of the journey. */
export function JourneyRoadmap({ label, steps }: {
  label: string;
  steps: readonly JourneyRoadmapStep[];
}) {
  return <nav className={styles.roadmap} aria-label={label}>
    <ol className={styles.steps}>
      {steps.map((step, index) => {
        const content = <>
          <span className={styles.marker} aria-hidden="true">{step.complete && !step.current ? <Icon name="ph-check" size={14} weight="bold" /> : index + 1}</span>
          <span className={styles.label}>{step.label}</span>
        </>;
        return <li key={`${index}-${step.label}`} className={`${styles.step} ${step.complete ? styles.complete : ""} ${step.current ? styles.current : ""}`}>
          {step.complete && <span className="sr-only">Completed step: </span>}
          {step.href ? <Link className={styles.link} href={step.href} aria-current={step.current ? "step" : undefined}>{content}</Link>
            : <span className={styles.link} aria-current={step.current ? "step" : undefined}>{content}</span>}
        </li>;
      })}
    </ol>
  </nav>;
}
