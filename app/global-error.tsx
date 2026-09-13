"use client";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, background: "#ffffff", color: "#20221f", fontFamily: "system-ui, sans-serif" }}>
        <title>Page unavailable · Xotic Car Rental</title>
        <main style={{ maxWidth: 640, margin: "12vh auto", padding: 32, lineHeight: 1.7 }}>
          <p style={{ letterSpacing: ".15em", fontSize: 12 }}>XOTIC / CAR RENTAL</p>
          <h1 style={{ fontSize: "clamp(32px, 6vw, 52px)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-.04em" }}>A brief pause in the journey.</h1>
          <p style={{ color: "#60645b", marginBottom: 28 }}>We could not load this page. Please try again in a moment.</p>
          <button onClick={() => retry()} style={{ minHeight: 48, padding: "12px 22px", border: 0, borderRadius: 3, background: "#ff7a00", color: "#171b18", fontSize: 14, cursor: "pointer" }}>Try again</button>
          <a href="/" style={{ marginLeft: 20, color: "#b15300" }}>Go to the homepage</a>
        </main>
      </body>
    </html>
  );
}
