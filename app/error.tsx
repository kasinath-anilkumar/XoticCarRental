"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <section className="sec py-16" aria-labelledby="error-title">
      <p className="kick">Please try again</p>
      <h1 id="error-title" className="text-[30px] max-md:text-[24px]">We could not load this page</h1>
      <p className="mt-4 max-w-[55ch] text-[var(--color-neutral-400)]">
        There was a problem loading the latest information. Try again, or return to the fleet to continue planning.
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        <button className="btn btn-primary" onClick={() => retry()}>Try again</button>
        <Link className="btn btn-secondary" href="/cars">Explore the fleet</Link>
      </div>
    </section>
  );
}
