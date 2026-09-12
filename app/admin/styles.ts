/**
 * The admin's shared class names.
 *
 * The public site is on Tailwind utilities written at the point of use; the
 * admin's are collected here instead, because a dozen screens and their client
 * components share the same card, table and row-form shapes, and a change to
 * "what an admin card looks like" should be one edit rather than twelve.
 *
 * Imported as `styles` so every call site reads as it did when this was a CSS
 * module: `className={styles.card}`.
 */
export const styles = {
  shell: "grid min-h-dvh grid-cols-[232px_1fr] items-start max-lg:grid-cols-1",
  sidebar: "sticky top-0 flex h-dvh flex-col gap-[2px] border-r border-[var(--color-divider)] bg-surface px-6 py-8 max-lg:static max-lg:h-auto max-lg:flex-row max-lg:flex-wrap max-lg:items-center max-lg:border-r-0 max-lg:border-b",
  brand: "mb-[2px] font-[family-name:var(--font-heading)] text-[17px] font-semibold tracking-[0.16em] text-text no-underline max-lg:mr-6 max-lg:mb-0",
  brandSub: "mb-8 text-[10px] tracking-[0.2em] uppercase text-[var(--color-neutral-500)] max-lg:hidden",
  navLink: "flex items-center gap-3 rounded-md px-4 py-3 text-[14px] text-[var(--color-neutral-300)] no-underline hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)]",
  navLinkActive: "flex items-center gap-3 rounded-md bg-[var(--color-accent-900)] px-4 py-3 text-[14px] text-[var(--color-accent-200)] no-underline",
  sidebarFoot: "mt-auto border-t border-[var(--color-divider)] pt-6 text-[11px] text-[var(--color-neutral-500)] max-lg:hidden",
  main: "min-w-0 p-12 max-lg:px-[var(--gutter-mobile)] max-lg:py-8",
  pageHead: "mb-8 flex flex-wrap items-end justify-between gap-6",
  pageTitle: "mt-0 mb-[4px] text-[28px] max-md:text-[22px]",
  pageLede: "m-0 max-w-[70ch] text-[13px] text-[var(--color-neutral-500)]",
  card: "mb-6 rounded-md bg-surface p-8 shadow-[var(--shadow-sm)]",
  cardTitle: "mt-0 mb-[4px] font-[family-name:var(--font-heading)] text-[17px]",
  cardHint: "mt-0 mb-6 text-[12px] text-[var(--color-neutral-500)]",
  grid2: "grid grid-cols-[repeat(2,1fr)] gap-4 max-md:grid-cols-1",
  grid3: "grid grid-cols-[repeat(3,1fr)] gap-4 max-lg:grid-cols-[repeat(2,1fr)] max-md:grid-cols-1",
  grid4: "grid grid-cols-[repeat(4,1fr)] gap-4 max-lg:grid-cols-[repeat(2,1fr)] max-md:grid-cols-1",
  tableWrap: "overflow-x-auto",
  actions: "mt-6 flex flex-wrap items-center gap-3",
  stats: "mb-8 grid grid-cols-[repeat(4,1fr)] gap-4 max-lg:grid-cols-[repeat(2,1fr)]",
  stat: "rounded-md bg-surface p-6 shadow-[var(--shadow-sm)]",
  statLabel: "m-0 text-[11px] tracking-[0.08em] uppercase text-[var(--color-neutral-500)]",
  statValue: "mt-[4px] mb-0 font-[family-name:var(--font-heading)] text-[28px]",
  banner: "mb-8 flex items-start gap-4 rounded-md border border-[var(--color-accent-700)] bg-[var(--color-accent-900)] p-6 text-[13px] text-[var(--color-neutral-200)]",
  bannerTitle: "mt-0 mb-[4px] font-[family-name:var(--font-heading)]",
  status: "inline-flex items-center rounded-sm bg-[var(--color-neutral-800)] px-[10px] py-[3px] text-[11px] text-[var(--color-neutral-100)]",
  statusNew: "inline-flex items-center rounded-sm bg-[var(--color-accent-800)] px-[10px] py-[3px] text-[11px] text-[var(--color-accent-100)]",
  statusConfirmed: "inline-flex items-center rounded-sm bg-[var(--color-positive-bg)] px-[10px] py-[3px] text-[11px] text-[var(--color-positive)]",
  statusLost: "inline-flex items-center rounded-sm bg-[var(--color-neutral-900)] px-[10px] py-[3px] text-[11px] text-[var(--color-neutral-500)]",
  muted: "text-[var(--color-neutral-500)]",
  right: "text-right",
  rowForm: "flex flex-wrap items-center gap-3 [&_.input]:max-w-[140px]",
  message: "mb-6 rounded-md bg-[var(--color-accent-900)] px-6 py-4 text-[13px] text-[var(--color-accent-100)]",
  messageError: "mb-6 rounded-md bg-[var(--color-negative-bg)] px-6 py-4 text-[13px] text-[var(--color-negative)]",
  loginPage: "grid min-h-dvh place-items-center p-12",
  loginCard: "w-[min(400px,100%)] rounded-lg bg-surface p-12 shadow-[var(--shadow-md)]",
  loginTitle: "mt-0 mb-[4px] text-[25px]",
  loginLede: "mb-8 text-[13px] text-[var(--color-neutral-500)]",
  loginFields: "flex flex-col gap-4",
} as const;

export default styles;
