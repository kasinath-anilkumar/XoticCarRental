import Link from "next/link";

export default function NotFound() {
  return (
    <section className="state-page">
      <span className="state-mark" aria-hidden="true">404</span>
      <p className="kick">404 · Page not found</p>
      <h1>Let’s get you back<br /><em>on the road.</em></h1>
      <p className="mt-4 text-[var(--color-neutral-400)]">This page may have moved, or the link may be incomplete.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/cars" className="btn btn-solid">Explore the fleet</Link>
        <Link href="/contact" className="btn btn-secondary">Contact us</Link>
      </div>
    </section>
  );
}
