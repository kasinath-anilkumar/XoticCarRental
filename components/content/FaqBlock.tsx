import { Icon } from "@/components/ui/Icon";


export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Questions and answers.
 *
 * Native <details>, so every answer is in the HTML whether or not JavaScript
 * runs — which is what makes the block worth anything to a search engine, and
 * the reason not to reach for a scripted accordion. The answers are generated
 * from live catalog data (see lib/faq.ts) rather than authored, so a rate change
 * cannot leave a stale figure sitting in an FAQ nobody re-reads.
 */
export function FaqBlock({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-[1fr_1fr] items-start gap-x-12 gap-y-0 max-lg:grid-cols-1">
      {items.map((item) => (
        <details key={item.q} className="group border-b border-[var(--color-divider)]">
          <summary className="flex cursor-pointer list-none items-center gap-4 py-[14px] font-[family-name:var(--font-heading)] text-[15px] hover:text-accent-text [&::-webkit-details-marker]:hidden">
            {item.q}
            <span className="ml-auto flex-none text-[var(--color-neutral-500)] transition-transform duration-[120ms] ease-in-out group-open:rotate-180 group-open:text-accent">
              <Icon name="ph-caret-down" size={15} />
            </span>
          </summary>
          <p className="mt-0 mb-6 max-w-[62ch] text-[14px] text-[var(--color-neutral-400)] [text-wrap:pretty]">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
