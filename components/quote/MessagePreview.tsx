"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/Icon";

export interface MessagePreviewProps {
  message: string;
  /** Open on a desktop where there is room; collapsed where there is not. */
  defaultOpen?: boolean;
  label?: string;
}

/**
 * Redesigned WhatsApp Message Preview card.
 *
 * Shows the customer the verbatim text that lands in the operator's chat,
 * styled in an authentic luxury WhatsApp bubble with a 1-tap copy button,
 * verified concierge badge, and reassurance note.
 */
export function MessagePreview({
  message,
  defaultOpen = false,
  label = "See the exact message you'll send",
}: MessagePreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  return (
    <details className="group rounded-xl border border-[var(--color-divider)] bg-surface p-3.5 sm:p-4 transition-colors hover:border-[var(--color-neutral-700)]" open={defaultOpen}>
      <summary className="inline-flex w-full cursor-pointer list-none items-center justify-between gap-2 py-0.5 font-[family-name:var(--font-heading)] text-[13.5px] sm:text-[14px] text-accent-text select-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-[#25D366]/15 text-[#25D366]">
            <Icon name="ph-whatsapp-logo" size={14} />
          </span>
          <span className="font-medium text-text">{label}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-[var(--color-neutral-400)] transition-transform duration-150 ease-in-out group-open:rotate-180">
          <Icon name="ph-caret-down" size={14} />
        </span>
      </summary>

      <div className="mt-3.5 pt-3.5 border-t border-[var(--color-divider)]">
        {/* WhatsApp Chat Card */}
        <div className="max-w-[560px] overflow-hidden rounded-xl border border-[#25D366]/30 bg-[linear-gradient(180deg,rgba(11,20,16,0.95)_0%,rgba(13,24,19,0.95)_100%)] p-4 shadow-md">
          {/* Header Bar */}
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#25D366]/20 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-[#25D366] text-black font-semibold text-[12px]">
                X
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-white">Xotic Luxury Concierge</span>
                  <span className="grid size-3.5 place-items-center rounded-full bg-[#25D366] text-black" title="Verified Fleet">
                    <Icon name="ph-check" size={9} />
                  </span>
                </div>
                <span className="block text-[10.5px] text-[#25D366]">Ready to deliver quote</span>
              </div>
            </div>

            {/* One-tap Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy message text"
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                copied
                  ? "bg-[#25D366] text-black"
                  : "bg-black/40 text-neutral-300 hover:bg-black/60 hover:text-white"
              }`}
            >
              <Icon name={copied ? "ph-check" : "ph-copy"} size={12} />
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Message Text Bubble */}
          <div className="rounded-lg bg-[rgba(0,0,0,0.35)] p-3 text-[12.5px] sm:text-[13px] leading-[1.65] font-mono [overflow-wrap:anywhere] whitespace-pre-wrap text-neutral-200 selection:bg-[#25D366]/30">
            {message}
          </div>

          {/* Timestamp & Double Checkmarks */}
          <div className="mt-2 flex items-center justify-end gap-1 text-[10.5px] text-[#25D366]/80">
            <span>Ready</span>
            <Icon name="ph-checks" size={13} />
          </div>
        </div>

        <p className="mt-2.5 text-[11.5px] text-[var(--color-neutral-400)] flex items-center gap-1.5">
          <Icon name="ph-shield-check" size={14} color="var(--color-accent)" />
          Nothing is sent until you press send inside WhatsApp. No payment happens here.
        </p>
      </div>
    </details>
  );
}
