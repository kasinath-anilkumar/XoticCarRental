export const REFERENCE_PAGE_SIZE = 20;
export const REFERENCE_KINDS = ["cities", "locations", "garages", "car_types", "occasions", "cars"] as const;
export type ReferenceKind = typeof REFERENCE_KINDS[number];
export interface ReferenceOption { value: string; label: string; detail?: string }
export interface ReferencePage { options: ReferenceOption[]; page: number; hasMore: boolean }

export function isReferenceKind(value: string): value is ReferenceKind {
  return (REFERENCE_KINDS as readonly string[]).includes(value);
}

/** User text stays a literal ILIKE substring, including SQL wildcard characters. */
export function searchPattern(value: string): string {
  return `%${value.trim().replace(/[\\%_]/g, "\\$&")}%`;
}

export function referenceRequest(params: URLSearchParams) {
  const kind = params.get("kind") ?? "";
  if (!isReferenceKind(kind)) throw new Error("Choose a supported reference type.");
  const query = (params.get("q") ?? "").trim();
  if (query.length > 100) throw new Error("Search must be 100 characters or fewer.");
  const rawPage = params.get("page") ?? "1";
  if (!/^[1-9]\d*$/.test(rawPage) || Number(rawPage) > 10_000) throw new Error("Invalid page.");
  const cityId = params.get("city") ?? "";
  if (cityId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cityId)) throw new Error("Invalid city.");
  return { kind, query, cityId, page: Number(rawPage) };
}
