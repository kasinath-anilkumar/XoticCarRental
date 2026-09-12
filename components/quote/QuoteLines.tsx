import { formatINR } from "@/lib/format";
import type { Quote } from "@/lib/types";


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
          className={`flex justify-between gap-4 border-b border-[var(--color-divider)] text-[13px] ${tight ? "py-[7px]" : "py-3"}`}
        >
          <span>
            {line.label}
            {line.note && (
              <span className="block text-[11px] text-[var(--color-neutral-600)]">{line.note}</span>
            )}
          </span>
          <span className="whitespace-nowrap">{formatINR(line.amount)}</span>
        </div>
      ))}

      {showSubtotal && (
        <div className={`flex justify-between text-[13px] text-[var(--color-neutral-400)] pt-3`}>
          <span>Subtotal</span>
          <span>{formatINR(quote.subtotal)}</span>
        </div>
      )}

      <div className={`flex justify-between text-[13px] text-[var(--color-neutral-400)] ${showSubtotal ? "" : "pt-3"}`}>
        <span>GST {gstPercent}%</span>
        <span>{formatINR(quote.gst)}</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-[var(--color-accent-700)] pt-4">
        <span className="font-[family-name:var(--font-heading)] text-[15px]">{totalLabel}</span>
        <span className="font-[family-name:var(--font-heading)] text-[28px] text-[var(--color-accent-300)]">
          {formatINR(quote.total)}
        </span>
      </div>
    </>
  );
}
