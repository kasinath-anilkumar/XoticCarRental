"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import type { TripRequest } from "@/lib/types";
import styles from "./Summary.module.css";


export interface SendToWhatsAppProps {
  trip: TripRequest;
  /** Used if the capture call fails, so the handoff still works. */
  fallbackHref: string;
  className?: string;
  label?: string;
  /** The compact variant in the mobile bar hides the name/phone fields. */
  withFields?: boolean;
  source?: string;
}

/**
 * The WhatsApp handoff.
 *
 * Records the quote first — the server recomputes it and stores the lead — then
 * opens the chat with whatever link the server returns. If the capture fails
 * for any reason, the visitor still reaches WhatsApp on the prepared link;
 * losing a booking to a logging problem would be the worse failure.
 */
export function SendToWhatsApp({
  trip,
  fallbackHref,
  className = "btn wa btn-block",
  label = "Send this quote on WhatsApp",
  withFields = false,
  source = "summary",
}: SendToWhatsAppProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fieldId = useId();
  const inFlight = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!note) return;
    feedback.current?.focus({ preventScroll: true });
    feedback.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [note]);

  const send = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setNote(null);

    // Opened before the await so the browser still treats it as user-initiated
    // and doesn't block it as a popup.
    const chat = window.open("", "_blank");
    if (chat) chat.opener = null;

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...trip, customerName: name, customerPhone: phone, source }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await response.json()) as {
        whatsappHref?: string;
        recorded?: boolean;
        error?: string;
      };
      if (!response.ok) {
        if (response.status >= 500) throw new Error("Enquiry service unavailable");
        chat?.close();
        setNote(data.error ?? "Please check your trip details and try again.");
        return;
      }
      const href = data.whatsappHref ?? fallbackHref;
      if (chat) chat.location.href = href;
      else window.location.href = href;
      if (!data.recorded) {
        setNote("Your details were not saved. Please send the WhatsApp message to complete your enquiry.");
      }
    } catch {
      if (chat) chat.location.href = fallbackHref;
      else window.location.href = fallbackHref;
      setNote("We couldn't save your details, but the chat is open with the full quote.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <>
      {withFields && (
        <>
          <h3 className={styles.contactTitle}>Your contact details</h3>
          <p className={styles.contactHint}>Optional — add your details for a callback.</p>
          <div className={styles.contactFields}>
            <div className="field">
              <label htmlFor={`${fieldId}-name`}>Your name</label>
              <input
                id={`${fieldId}-name`}
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={120}
              />
            </div>
            <div className="field">
              <label htmlFor={`${fieldId}-phone`}>Phone</label>
              <input
                id={`${fieldId}-phone`}
                className="input"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                maxLength={32}
              />
            </div>
          </div>
        </>
      )}

      <button type="button" className={className} onClick={send} disabled={sending} aria-busy={sending}>
        <Icon name="ph-whatsapp-logo" size={21} />
        {sending ? "Opening WhatsApp…" : label}
      </button>

      {note && <div ref={feedback} tabIndex={-1} role="alert" className={styles.sendNote}>{note}</div>}
    </>
  );
}
