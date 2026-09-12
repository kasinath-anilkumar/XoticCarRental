"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { track } from "@/lib/analytics";

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
  const [date, setDate] = useState("");
  const [days, setDays] = useState("1");
  const [state, setState] = useState<"idle" | "checking" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) return;

    setState("checking");
    setError(null);
    track("availability_check", { car: carSlug });

    try {
      const response = await fetch(
        `/api/availability?car=${encodeURIComponent(carSlug)}&date=${date}&days=${days}`,
      );
      const data = (await response.json()) as Result & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not check that just now.");
        setState("error");
        return;
      }
      setResult(data);
      setState("done");
    } catch {
      setError("The network dropped that. Try again, or just message us.");
      setState("error");
    }
  }

  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-divider)] p-4">
      <p className="font-[family-name:var(--font-heading)] text-[15px]">Check availability</p>
      <p className="mt-0.5 mb-3 text-[12px] text-[var(--color-neutral-400)]">
        Against the live calendar. A free date still has to be confirmed by the team.
      </p>

      <form onSubmit={check} className="flex flex-wrap items-end gap-2">
        <label className="field flex-1" style={{ minWidth: "150px" }}>
          <span>From</span>
          <input
            className="input"
            type="date"
            value={date}
            min={today}
            onChange={(event) => {
              setDate(event.target.value);
              setState("idle");
            }}
            required
          />
        </label>
        <label className="field" style={{ width: "78px" }}>
          <span>Days</span>
          <input
            className="input"
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(event) => {
              setDays(event.target.value);
              setState("idle");
            }}
          />
        </label>
        <button type="submit" className="btn btn-secondary" disabled={state === "checking"}>
          {state === "checking" ? "Checking…" : "Check"}
        </button>
      </form>

      {state === "error" && (
        <p className="mt-2 text-[12px] text-[var(--color-accent)]" role="alert">
          {error}
        </p>
      )}

      {state === "done" && result && (
        <output className="mt-3 block text-[13px]">
          {result.available ? (
            <p className="flex items-start gap-1.5">
              <Icon name="ph-check-circle" size={16} color="var(--color-accent)" />
              <span>
                Free from {date}
                {Number(days) > 1 ? ` for ${days} days` : ""}. Price the route and we will hold it
                against your reference.
              </span>
            </p>
          ) : (
            <div>
              <p className="flex items-start gap-1.5">
                <Icon name="ph-warning-circle" size={16} color="var(--color-accent)" />
                <span>
                  Not available then.
                  {result.nextFree ? ` The next clear run starts ${result.nextFree}.` : ""}
                </span>
              </p>
              {result.alternatives.length > 0 && (
                <p className="mt-1.5 text-[var(--color-neutral-400)]">
                  Free that day:{" "}
                  {result.alternatives.map((car, index) => (
                    <span key={car.slug}>
                      {index > 0 && ", "}
                      <Link href={`/cars/${car.slug}`} className="text-[var(--color-accent)]">
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
    </div>
  );
}
