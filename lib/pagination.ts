export const CARS_PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 25;

/** Ignore malformed and unsafe offsets rather than forwarding them to SQL. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page <= 100_000 ? page : 1;
}

export function pageBounds(total: number, requestedPage: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  const offset = (page - 1) * pageSize;
  return { page, pageCount, offset, from: total ? offset + 1 : 0, to: Math.min(offset + pageSize, total) };
}

export function pageHref(path: string, query: string, page: number): string {
  const params = new URLSearchParams(query);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

/** Read until exhausted even when the database caps pages below our requested limit. */
export async function readKeysetPages<T extends { id: string }>(
  load: (after: string | undefined) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  while (true) {
    const batch = await load(after);
    if (batch.length === 0) return rows;
    const next = batch[batch.length - 1].id;
    if (!next || next === after) throw new Error("Catalog pagination did not advance.");
    rows.push(...batch);
    after = next;
  }
}
