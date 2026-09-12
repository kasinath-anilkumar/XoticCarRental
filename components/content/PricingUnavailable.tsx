import Link from "next/link";

/** Customer-facing fallback while the published fleet or pricing is incomplete. */
export function PricingUnavailable() {
  return (
    <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-8 max-md:p-6">
      <h2 className="h2 mb-3">Online pricing is currently unavailable</h2>
      <p className="mb-5 max-w-[60ch] text-[14px] text-text">
        Contact our team to check available cars and get a quote for your journey.
      </p>
      <Link href="/contact" className="btn btn-primary">Contact our team</Link>
    </div>
  );
}
