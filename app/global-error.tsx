"use client";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, background: "#fff", color: "#0f0f0f", fontFamily: "system-ui, sans-serif" }}>
        <title>Page unavailable · Xotic Car Rental</title>
        <main style={{ maxWidth: 640, margin: "12vh auto", padding: 24 }}>
          <p>XOTIC CAR RENTAL</p>
          <h1>We could not load this page</h1>
          <p>Please try again in a moment.</p>
          <button onClick={() => retry()} style={{ padding: "12px 20px", cursor: "pointer" }}>Try again</button>
          <a href="/" style={{ marginLeft: 20, color: "#b15300" }}>Go to the homepage</a>
        </main>
      </body>
    </html>
  );
}
