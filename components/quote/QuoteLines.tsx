import { formatINR } from "@/lib/format";
import type { Quote } from "@/lib/types";
import styles from "./QuoteLines.module.css";


export interface QuoteLinesProps {
  quote: Quote;
  gstPercent: number;
  /** The home preview omits the subtotal row; the calculator shows it. */
  showSubtotal?: boolean;
  totalLabel?: string;
  tight?: boolean;
}

export function QuoteLines({
  quote,
  gstPercent,
  showSubtotal = false,
  totalLabel = "Total",
  tight = false,
}: QuoteLinesProps) {
  return (
    <>
      {quote.lines.map((line) => (
        <div
          key={line.label}
          className={`${styles.line} ${tight ? styles.tight : ""}`}
        >
          <span className={styles.label}>
            {line.label}
            {line.note && (
              <span className={styles.note}>{line.note}</span>
            )}
          </span>
          <span className={styles.amount}>{formatINR(line.amount)}</span>
        </div>
      ))}

      {showSubtotal && (
        <div className={styles.subtotal}>
          <span>Subtotal</span>
          <span>{formatINR(quote.subtotal)}</span>
        </div>
      )}

      <div className={styles.tax}>
        <span>GST {gstPercent}%</span>
        <span>{formatINR(quote.gst)}</span>
      </div>

      <div className={styles.total}>
        <span>{totalLabel}</span>
        <span>
          {formatINR(quote.total)}
        </span>
      </div>
    </>
  );
}
