import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";

import { requireAdmin } from "@/lib/admin/auth";
import { formatINR } from "@/lib/format";
import { LEAD_STATUS_LABELS, LEAD_STATUSES, OPEN_STATUSES, type LeadStatus } from "@/lib/leads";
import { getStore, isLocalStore } from "@/lib/store";
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/pagination";

import { AdminPageHead, AdminShell } from "../AdminShell";
import { LeadRow } from "./EnquiryRow";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS = ["overdue", "open", "all", ...LEAD_STATUSES] as const;

/** Today in IST — the business's day, which is what a follow-up is due on. */
function today(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * The lead desk.
 *
 * §15 and §16 are the reason this page exists in the shape it does. It is not a
 * log of quotes — it is a worklist, so the first thing it answers is "what is
 * overdue", and that view is the default. The brief is explicit that the
 * business problem being solved is enquiries going quiet on WhatsApp, and a
 * dashboard that opens on "everything, newest first" does nothing about that.
 */
export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const store = getStore();

  const raw = Array.isArray(params.view) ? params.view[0] : params.view;
  const view = (FILTERS as readonly string[]).includes(raw ?? "") ? raw! : "overdue";

  const now = today();
  const [result, counts] = await Promise.all([
    store.listLeadsPage(
      view === "overdue" ? { status: "open", overdueOn: now } : { status: view as LeadStatus | "all" | "open" },
      parsePage(params.page),
      ADMIN_PAGE_SIZE,
    ),
    store.getLeadCounts(now),
  ]);
  const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (result.page > lastPage) redirect(`/admin/enquiries?view=${view}&page=${lastPage}`);
  const leads = result.items;

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Leads"
        lede="Every enquiry sent to WhatsApp, with the reference the customer is holding. Totals were recomputed on the server before being stored, so these are the numbers we stand behind."
      />

      {isLocalStore() && (
        <p className={styles.message} style={{ marginBottom: "16.8px" }}>
          Recording to <code>.data/store.json</code> — no database is configured. Leads captured
          here are for testing and will not migrate themselves; set the Supabase keys and they go
          to the <code>enquiries</code> table instead.
        </p>
      )}

      {counts.overdue > 0 && view !== "overdue" && (
        <p className={styles.message} style={{ marginBottom: "16.8px" }}>
          <strong>{counts.overdue}</strong> {counts.overdue === 1 ? "lead is" : "leads are"} due a
          follow-up. <Link href="/admin/enquiries?view=overdue">Show them</Link>.
        </p>
      )}

      <div className={styles.actions} style={{ marginTop: 0, marginBottom: "16.8px" }}>
        {FILTERS.map((option) => {
          const label =
            option === "overdue"
              ? `Due now${counts.overdue ? ` (${counts.overdue})` : ""}`
              : option === "open"
                ? `Open (${counts.open})`
                : option === "all"
                  ? `All (${counts.all})`
                  : LEAD_STATUS_LABELS[option as LeadStatus];
          return (
            <Link
              key={option}
              prefetch={false}
              href={`/admin/enquiries?view=${option}`}
              className={`btn ${view === option ? "btn-primary" : "btn-secondary"}`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div>
        {leads.map((lead) => (
          <LeadRow
            key={lead.id}
            id={lead.id}
            leadId={lead.leadId}
            createdAt={lead.createdAt}
            customerName={lead.customerName}
            customerPhone={lead.customerPhone}
            customerPlace={lead.customerPlace}
            carName={lead.carName ?? "—"}
            packageLabel={lead.packageLabel ?? "—"}
            serviceName={lead.serviceName}
            tripType={lead.tripType}
            stops={lead.stops}
            pickup={[lead.pickupDate, lead.pickupTime].filter(Boolean).join(" · ") || "No date given"}
            km={lead.km}
            transferKm={lead.transferKm}
            hours={lead.hours}
            days={lead.days}
            total={formatINR(lead.total)}
            advance={formatINR(lead.advance)}
            lines={lead.lines}
            status={lead.status}
            assignedTo={lead.assignedTo}
            followUpOn={lead.followUpOn}
            overdue={
              OPEN_STATUSES.includes(lead.status) &&
              lead.followUpOn !== null &&
              lead.followUpOn <= now
            }
            notes={lead.notes}
            details={lead.details}
            quoted={lead.total > 0}
          />
        ))}

        {leads.length === 0 && (
          <p className={styles.cardHint}>
            {view === "overdue"
              ? "No follow-ups are due. Check open leads for enquiries without a follow-up date."
              : `No leads in "${view}".`}
          </p>
        )}
      </div>
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} path="/admin/enquiries" query={`view=${view}`} label="leads" />
    </AdminShell>
  );
}
