import Link from "next/link";

export default function NotFound() {
  return (
    <section className="sec py-16">
      <p className="kick">404 · Page not found</p>
      <h1 className="text-[30px] max-md:text-[24px]">Let’s get you back on the road</h1>
      <p className="mt-4 text-[var(--color-neutral-400)]">This page may have moved, or the link may be incomplete.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/cars" className="btn btn-primary">Explore the fleet</Link>
        <Link href="/contact" className="btn btn-secondary">Contact us</Link>
      </div>
    </section>
  );
}
