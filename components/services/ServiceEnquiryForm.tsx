"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { businessDate } from "@/lib/dates";
import type { Service } from "@/lib/services";

/**
 * The enquiry form for one service (§12).
 *
 * It is generated from the service's own field list, which is the point: a
 * wedding is asked for a venue and a convoy count, a monthly hire for hours a
 * day, and neither is asked the other's questions. A single generic form would
 * be less code and would lose the answers that make a lead quotable.
 *
 * The lead is recorded first and WhatsApp opens second, so an enquiry survives
 * a customer who never sends the message — which, on a phone, is most of the
 * ones that fail.
 */
export function ServiceEnquiryForm({ service }: { service: Service }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [href, setHref] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [returnDate, setReturnDate] = useState<string>("");
  const fieldId = useId();
  const inFlight = useRef(false);
  const [today, setToday] = useState<string>();

  useEffect(() => {
    // Cached HTML can outlive its render date. Keep hydration deterministic,
    // then use the current business date and refresh after midnight/tab return.
    const refresh = () => setToday(businessDate());
    const frame = requestAnimationFrame(refresh);
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const durationDays = useMemo(() => {
    if (!startDate || !returnDate || returnDate < startDate) return null;
    const start = new Date(startDate).getTime();
    const end = new Date(returnDate).getTime();
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 1 ? diff : null;
  }, [startDate, returnDate]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = new FormData(event.currentTarget);

    const answers: Record<string, string> = {};
    for (const field of service.fields) {
      const value = form.get(field.name);
      if (typeof value === "string" && value.trim()) answers[field.name] = value.trim();
    }
    const returnVal = form.get("returnDate");
    if (typeof returnVal === "string" && returnVal.trim()) {
      answers["returnDate"] = returnVal.trim();
    }

    inFlight.current = true;
    setStatus("sending");
    setError(null);
    // Keep the handoff attached to the user's click, including on mobile Safari.
    const chat = window.open("", "_blank");
    if (chat) chat.opener = null;

    try {
      const response = await fetch("/api/enquiries/service", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          service: service.slug,
          customerName: form.get("customerName"),
          customerPhone: form.get("customerPhone"),
          answers,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = (await response.json()) as {
        error?: string;
        leadId?: string;
        whatsappHref?: string;
        recorded?: boolean;
      };

      if (!response.ok) {
        chat?.close();
        setError(data.error ?? "That did not go through. Try again, or message us on WhatsApp.");
        setStatus("error");
        return;
      }

      if (!data.whatsappHref && !data.recorded) throw new Error("Incomplete enquiry response");
      setRecorded(data.recorded === true);
      setReference(data.recorded ? data.leadId ?? null : null);
      setHref(data.whatsappHref ?? null);
      setStatus("sent");

      if (data.whatsappHref && chat) chat.location.href = data.whatsappHref;
      else chat?.close();
    } catch {
      chat?.close();
      setError("The network dropped that. Try again, or message us on WhatsApp.");
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  if (status === "sent") {
    return (
      <div aria-live="polite" tabIndex={-1} ref={(element) => { element?.focus(); }}
        className="rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-6 text-center">
        <Icon name={recorded ? "ph-check-circle" : "ph-whatsapp-logo"} size={32} color="var(--color-accent)" />
        <h3 className="mt-2 font-[family-name:var(--font-heading)] text-xl">
          {recorded ? `Enquiry received${reference ? ` — reference ${reference}` : ""}` : "One more step: send your WhatsApp message"}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-neutral-400)]">
          {recorded
            ? "Our team will contact you about availability. Keep your reference handy."
            : "We could not save your enquiry. Send the prepared message on WhatsApp so our team receives your details."}
        </p>
        <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">
          WhatsApp opens with the message written out. Nothing is sent until you tap send.
        </p>
        {href && (
          <a className="btn wa mt-4" href={href} target="_blank" rel="noopener noreferrer">
            <Icon name="ph-whatsapp-logo" size={16} />
            Open the WhatsApp message
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-busy={status === "sending"}
      className="rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-5 sm:p-6"
    >
      <h2 className="font-[family-name:var(--font-heading)] text-xl">Ask about {service.short.toLowerCase()}</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--color-neutral-400)]">
        The questions below are the ones we would ask on the phone. Answer what you know — a blank is
        better than a guess.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Your name</span>
          <input name="customerName" className="input" autoComplete="name" placeholder="Name" maxLength={120} />
        </label>

        <label className="field">
          <span>
            Phone <span className="text-[var(--color-accent)]">*</span>
          </span>
          <input
            name="customerPhone"
            className="input"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91"
            maxLength={32}
            minLength={7}
            title="Enter a phone number, including the country code if outside India."
          />
        </label>

        {service.fields.map((field) => (
          <div key={field.name} className="contents">
            <div className={`field ${field.wide ? "sm:col-span-2" : ""}`}>
              <label id={`${fieldId}-${field.name}-label`} htmlFor={field.type === "select" ? undefined : `${fieldId}-${field.name}`}>
                {field.label}
                {field.required && <span className="text-[var(--color-accent)]"> *</span>}
              </label>

              {field.type === "date" ? (
                <input
                  name={field.name}
                  id={`${fieldId}-${field.name}`}
                  className="input"
                  type="date"
                  required={field.required || Boolean(returnDate)}
                  placeholder={field.placeholder}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (returnDate && e.target.value > returnDate) {
                      setReturnDate(e.target.value);
                    }
                  }}
                  min={today}
                />
              ) : field.type === "select" ? (
                <fieldset className="mt-1 min-w-0" aria-labelledby={`${fieldId}-${field.name}-label`}>
                  <div className="flex flex-wrap gap-2">
                    {(field.options ?? []).map((option, index) => (
                      <label key={option} className="cursor-pointer">
                        <input type="radio" className="peer sr-only" name={field.name} value={option} defaultChecked={index === 0} required={field.required} />
                        <span className="flex min-h-[40px] items-center rounded-lg border border-[var(--color-divider)] bg-well px-3 py-1.5 text-[12px] text-[var(--color-neutral-300)] transition-colors hover:border-[var(--color-accent)] peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent-800)] peer-checked:text-[var(--color-accent-100)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-accent)] sm:text-[13px]">
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  id={`${fieldId}-${field.name}`}
                  className="input"
                  rows={3}
                  placeholder={field.placeholder}
                  maxLength={600}
                  required={field.required}
                />
              ) : (
                <input
                  name={field.name}
                  id={`${fieldId}-${field.name}`}
                  className="input"
                  type={field.type}
                  required={field.required}
                  placeholder={field.placeholder}
                  maxLength={field.type === "number" ? undefined : 120}
                  {...(field.type === "number" ? { min: 0, inputMode: "numeric" as const } : {})}
                />
              )}

              {field.hint && (
                <span className="text-[11px] text-[var(--color-neutral-400)]">{field.hint}</span>
              )}
            </div>

            {field.type === "date" && (
              <label className="field">
                <span className="flex items-center justify-between">
                  <span>
                    Return date{" "}
                    <span className="text-[11px] font-normal text-[var(--color-neutral-400)]">
                      (optional)
                    </span>
                  </span>
                  {durationDays && (
                    <span className="rounded bg-[var(--color-accent-800)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--color-accent-200)]">
                      {durationDays} days hire
                    </span>
                  )}
                </span>
                <input
                  name="returnDate"
                  className="input"
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  min={startDate || today}
                />
                <span className="text-[11px] text-[var(--color-neutral-400)]">
                  For multi-day events, outstation or round trips
                </span>
              </label>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-[var(--color-accent)]" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-block mt-4"
        disabled={status === "sending"}
      >
        {status === "sending" ? (
          "Sending…"
        ) : (
          <>
            <Icon name="ph-whatsapp-logo" size={16} />
            Send Enquiry on WhatsApp
          </>
        )}
      </button>

      <p className="mt-2 text-center text-[11px] text-[var(--color-neutral-400)]">
        We call back the same day. Your number is used for this enquiry and nothing else.
      </p>
    </form>
  );
}
