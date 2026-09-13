"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { track } from "@/lib/analytics";
import { MAX_TRIP_DAYS } from "@/lib/trip-limits";
import styles from "./CheckAvailability.module.css";

interface Result {
  available: boolean;
  nextFree: string | null;
  alternatives: Array<{ slug: string; name: string }>;
}

/**
 * Check Availability (§20).
 *
 * The one question a customer looking at a specific car actually has, and the
 * one the site could not answer until availability was stored. It asks the real
 * calendar, and it is careful about what it says back: a car that is held is
 * "not available", never "booked for a wedding on the 14th".
 *
 * A "yes" is not a booking — §11 — so the wording is "worth asking about" and
 * the next step is still a quote or a message.
 */
export function CheckAvailability({ carSlug, today }: { carSlug: string; today: string }) {
  const id = useId();
  const [date, setDate] = useState("");
  const [days, setDays] = useState("1");
  const [state, setState] = useState<"idle" | "checking" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Keep server-rendered controls inactive until their change handlers exist.
    // oxlint-disable-next-line react/set-state-in-effect -- Readiness must change only after hydration commits.
    setReady(true);
    return () => requestRef.current?.abort();
  }, []);

  function invalidateResult() {
    requestRef.current?.abort();
    requestRef.current = null;
    setResult(null);
    setError(null);
    setState("idle");
  }

  async function check(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setState("checking");
    setResult(null);
    setError(null);
    track("availability_check", { car: carSlug });

    try {
      const response = await fetch(
        `/api/availability?car=${encodeURIComponent(carSlug)}&date=${date}&days=${days}`,
        { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) },
      );
      const data = (await response.json()) as Result & { error?: string };
      if (controller.signal.aborted || requestRef.current !== controller) return;
      if (!response.ok) {
        setError(data.error ?? "Could not check that just now.");
        setState("error");
        return;
      }
      setResult(data);
      setState("done");
    } catch {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setError("The network dropped that. Try again, or just message us.");
      setState("error");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <div className={styles.row}>
        <header className={styles.header}>
          <h2 id={`${id}-heading`} className={styles.title}><Icon name="ph-calendar-blank" size={22} />Check availability</h2>
          <p id={`${id}-description`} className={styles.description}>
            Against the live calendar. A free date still has to be confirmed by the team.
          </p>
        </header>

      <form onSubmit={check} className={styles.form} aria-describedby={`${id}-description`} aria-busy={state === "checking"}>
        <label className={styles.field}>
          <span>From</span>
          <input
            type="date"
            disabled={!ready}
            value={date}
            min={today}
            onChange={(event) => {
              setDate(event.target.value);
              invalidateResult();
            }}
            required
          />
        </label>
        <label className={styles.field}>
          <span>Days</span>
          <input
            type="number"
            disabled={!ready}
            min={1}
            max={MAX_TRIP_DAYS}
            value={days}
            onChange={(event) => {
              setDays(event.target.value);
              invalidateResult();
            }}
          />
        </label>
        <button type="submit" className={styles.check} disabled={!ready || state === "checking"}>
          {state === "checking" ? "Checking…" : "Check"}
          <Icon name="ph-arrow-right" size={17} />
        </button>
      </form>
      </div>

      {state === "error" && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {state === "done" && result && (
        <output className={styles.result}>
          {result.available ? (
            <p className={styles.resultLine}>
              <Icon name="ph-check-circle" size={16} color="var(--color-accent)" />
              <span>
                Free from {date}
                {Number(days) > 1 ? ` for ${days} days` : ""}. Send your route and our team will
                confirm availability before booking.
              </span>
            </p>
          ) : (
            <div>
              <p className={styles.resultLine}>
                <Icon name="ph-warning-circle" size={16} color="var(--color-accent)" />
                <span>
                  Not available then.
                  {result.nextFree ? ` The next clear run starts ${result.nextFree}.` : ""}
                </span>
              </p>
              {result.alternatives.length > 0 && (
                <p className={styles.alternatives}>
                  Free that day:{" "}
                  {result.alternatives.map((car, index) => (
                    <span key={car.slug}>
                      {index > 0 && ", "}
                      <Link href={`/cars/${car.slug}`}>
                        {car.name}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
        </output>
      )}
    </section>
  );
}
