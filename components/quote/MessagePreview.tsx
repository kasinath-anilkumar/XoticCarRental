"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import styles from "./MessagePreview.module.css";

export interface MessagePreviewProps {
  message: string;
  /** Open on a desktop where there is room; collapsed where there is not. */
  defaultOpen?: boolean;
  label?: string;
}

/** Review the actual message before leaving the site. */
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
    <details className={styles.preview} open={defaultOpen}>
      <summary className={styles.summary}><span><Icon name="ph-chat-teardrop-text" size={18} />{label}</span><Icon name="ph-caret-down" size={15} /></summary>
      <div className={styles.content}>
        <div className={styles.heading}><p>WhatsApp message preview</p><button type="button" className={styles.copy} onClick={handleCopy} aria-label="Copy message text"><Icon name={copied ? "ph-check" : "ph-copy"} size={14} /><span>{copied ? "Copied" : "Copy"}</span></button></div>
        <p className={styles.message}>{message}</p>
        {copied && <output className="sr-only">Message copied</output>}
        <p className={styles.note}><Icon name="ph-shield-check" size={16} />Nothing is sent until you press send inside WhatsApp. No payment happens here.</p>
      </div>
    </details>
  );
}
