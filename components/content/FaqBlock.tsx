import { Icon } from "@/components/ui/Icon";
import styles from "./Editorial.module.css";

export interface FaqItem { q: string; a: string; }

/** Native disclosure keeps the answers accessible without client JavaScript. */
export function FaqBlock({ items }: { items: FaqItem[] }) {
  if (!items.length) return null;
  return <div className={styles.faq}>{items.map((item) => <details key={item.q}>
    <summary>{item.q}<span><Icon name="ph-caret-down" size={15} /></span></summary>
    <p>{item.a}</p>
  </details>)}</div>;
}
