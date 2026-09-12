/** Calendar dates compare lexically only after validating the real calendar. */
export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function businessDate(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  if (!isISODate(date) || !Number.isSafeInteger(days)) throw new Error("Invalid date interval.");
  const result = new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000);
  if (!Number.isFinite(result.getTime())) throw new Error("Invalid date interval.");
  const value = result.toISOString().slice(0, 10);
  if (!isISODate(value)) throw new Error("Invalid date interval.");
  return value;
}
