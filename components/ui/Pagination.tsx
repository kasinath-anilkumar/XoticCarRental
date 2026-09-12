import Link from "next/link";

import { pageBounds, pageHref } from "@/lib/pagination";

export function Pagination({
  total, page, pageSize, path, query = "", label = "results",
}: {
  total: number;
  page: number;
  pageSize: number;
  path: string;
  query?: string;
  label?: string;
}) {
  const bounds = pageBounds(total, page, pageSize);
  if (!total) return null;
  return (
    <nav aria-label={`${label} pagination`} className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-divider)] pt-5">
      <p className="text-[13px] text-[var(--color-neutral-400)]">
        Showing {bounds.from}–{bounds.to} of {total} {label}
      </p>
      {bounds.pageCount > 1 && (
        <div className="flex items-center gap-3">
          {bounds.page > 1 ? (
            <Link prefetch={false} href={pageHref(path, query, bounds.page - 1)} className="btn btn-secondary" rel="prev">Previous</Link>
          ) : <span className="btn btn-secondary pointer-events-none opacity-40" aria-disabled="true">Previous</span>}
          <span aria-current="page" className="text-[13px]">Page {bounds.page} of {bounds.pageCount}</span>
          {bounds.page < bounds.pageCount ? (
            <Link prefetch={false} href={pageHref(path, query, bounds.page + 1)} className="btn btn-secondary" rel="next">Next</Link>
          ) : <span className="btn btn-secondary pointer-events-none opacity-40" aria-disabled="true">Next</span>}
        </div>
      )}
    </nav>
  );
}
