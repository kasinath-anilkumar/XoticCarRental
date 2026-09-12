/** Bound every worklist request, including direct calls with invalid URL values. */
export function pagination(page = 1, pageSize = 25) {
  const size = Number.isSafeInteger(pageSize) ? Math.min(100, Math.max(1, pageSize)) : 25;
  const current = Number.isSafeInteger(page) ? Math.min(100_000, Math.max(1, page)) : 1;
  return { page: current, pageSize: size, offset: (current - 1) * size };
}
