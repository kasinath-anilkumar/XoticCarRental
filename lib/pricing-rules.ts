import type { PricingRules } from "./types";

/** Live pricing must use a complete validated settings row, never demo defaults. */
export function parsePricingRules(value: unknown): PricingRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Pricing rules are not configured.");
  const rules = value as Record<string, unknown>;
  const read = (key: keyof PricingRules, min: number, max: number, integer = false): number => {
    const number = rules[key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
      throw new Error(`Invalid pricing rule: ${key}.`);
    }
    return number;
  };
  const result = {
    minimumLegKm: read("minimumLegKm", 0, 100),
    localSpeedKph: read("localSpeedKph", 1, 160),
    outstationSpeedKph: read("outstationSpeedKph", 1, 160),
    oneWayReturnPercent: read("oneWayReturnPercent", 0, 100),
    nightStartHour: read("nightStartHour", 0, 23, true),
    nightEndHour: read("nightEndHour", 0, 23, true),
  };
  if (result.nightStartHour === result.nightEndHour) throw new Error("Night charge start and end hours must differ.");
  return result;
}
