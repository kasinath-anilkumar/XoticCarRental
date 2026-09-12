/** Only booking choices travel between browse, vehicle and calculator pages. */
const JOURNEY_KEYS = ["from", "to", "ret", "stops", "cust", "date", "returnDate", "time", "pkg", "trip", "occ", "halt"] as const;

export function copyJourneyParams(source: string | URLSearchParams): URLSearchParams {
  const input = typeof source === "string" ? new URLSearchParams(source) : source;
  const result = new URLSearchParams();
  for (const key of JOURNEY_KEYS) {
    const value = input.get(key);
    if (value !== null) result.set(key, value);
  }
  return result;
}

export function calculatorJourneyHref(base: string, incoming: string, packageSlug: string): string {
  const params = new URLSearchParams(base);
  const choices = copyJourneyParams(incoming);
  // An explicitly selected pickup supersedes empty default itinerary slots.
  if (choices.has("from") && !choices.has("stops")) params.delete("stops");
  for (const [key, value] of choices) params.set(key, value);
  params.set("pkg", packageSlug);
  return `/price-calculator?${params}`;
}
