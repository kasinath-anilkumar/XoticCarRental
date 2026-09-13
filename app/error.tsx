"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <section className="state-page" aria-labelledby="error-title">
      <span className="state-mark" aria-hidden="true">↗</span>
      <p className="kick">Please try again</p>
      <h1 id="error-title">A brief pause<br /><em>in the journey.</em></h1>
      <p className="mt-4 max-w-[55ch] text-[var(--color-neutral-400)]">
        There was a problem loading the latest information. Try again, or return to the fleet to continue planning.
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        <button className="btn btn-solid" onClick={() => retry()}>Try again</button>
        <Link className="btn btn-secondary" href="/cars">Explore the fleet</Link>
      </div>
    </section>
  );
}
