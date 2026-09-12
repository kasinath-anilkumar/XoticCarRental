export default function Loading() {
  return (
    <section className="sec py-12" aria-label="Loading page">
      <output className="kick block">Loading your next journey…</output>
      <div aria-hidden="true" className="mt-6 grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-[240px] rounded-lg bg-well motion-safe:animate-pulse" />
        ))}
      </div>
    </section>
  );
}
