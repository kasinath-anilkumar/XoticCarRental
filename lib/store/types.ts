/**
 * The write side of the site.
 *
 * Reading is already solved: with no database configured the catalog falls
 * back to `backend/seed-data.js`, so every page renders. Writing had no such
 * fallback — an enquiry went nowhere, which meant lead management, follow-ups
 * and availability could not be built or demonstrated until Supabase existed.
 *
 * So the writes go through this interface, and there are two implementations:
 *
 *   local     a JSON file under .data/ — the default, for development and for
 *             showing the thing to somebody before the database is set up
 *   supabase  the real one, chosen automatically the moment the environment
 *             has credentials
 *
 * The shapes below are the domain's, not a table's: a lead is a lead in both.
 */

import type { LeadStatus } from "../leads";

/** One stop as it was entered, kept verbatim so history cannot be rewritten. */
export interface LeadStop {
  name: string;
  role: "pickup" | "stop" | "drop";
}

/**
 * One answer to a service-specific question (§12).
 *
 * Stored as label/value pairs rather than a typed object per service: the
 * questions differ by service and will change as the business learns which
 * ones staff actually use, and a schema that has to be migrated every time a
 * field is reworded is a schema that stops being edited.
 */
export interface LeadDetail {
  label: string;
  value: string;
  /** The selected geocoder result, preserved without exposing a raw token in messages. */
  place?: { token: string; lat: number; lng: number };
}

export interface LeadLine {
  label: string;
  note: string;
  amount: number;
}

export interface Lead {
  id: string;
  /** The shared reference: WED-260821-001. */
  leadId: string;
  createdAt: string;

  customerName: string | null;
  customerPhone: string | null;
  /** Where the customer said they are — not part of the route. */
  customerPlace: string | null;

  serviceSlug: string;
  /** Resolved from the service definition by the trusted enquiry handler. */
  occasionSlug?: string;
  serviceName: string;
  carSlug: string | null;
  carName: string | null;
  packageLabel: string | null;

  tripType: string;
  stops: LeadStop[];
  pickupDate: string;
  pickupTime: string;
  haltHours: number;

  km: number;
  /** The dead-head part of `km`, so staff can see the split. */
  transferKm: number;
  hours: number;
  days: number;
  lines: LeadLine[];
  subtotal: number;
  gst: number;
  total: number;
  advance: number;

  status: LeadStatus;
  assignedTo: string | null;
  /** The day this lead is due a chase. Overdue rows lead the dashboard. */
  followUpOn: string | null;
  notes: string | null;
  source: string;
  /** What the service's own form asked, in the order it asked it (§12). */
  details: LeadDetail[];
}

/** A dated hold on a vehicle (§17). */
export interface Availability {
  id: string;
  carSlug: string;
  status: "booked" | "unavailable" | "maintenance" | "hold";
  startsOn: string;
  endsOn: string;
  note: string | null;
  leadId: string | null;
}

export interface LeadFilter {
  status?: LeadStatus | "all" | "open";
  /** Only leads whose follow-up date has passed. */
  overdueOn?: string;
  assignedTo?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AvailabilityFilter {
  carSlug?: string;
  /** Include holds overlapping this inclusive date window. */
  from?: string;
  to?: string;
  pastBefore?: string;
}

export interface LeadCounts {
  all: number;
  open: number;
  overdue: number;
}

export interface Store {
  /** Which implementation answered, for the banner in the admin. */
  readonly kind: "local" | "supabase";

  /** Allocate the customer reference inside the store, never by scanning in a route. */
  createLead(lead: Omit<Lead, "id" | "createdAt" | "leadId">): Promise<Lead>;
  listLeads(filter?: LeadFilter): Promise<Lead[]>;
  listLeadsPage(filter?: LeadFilter, page?: number, pageSize?: number): Promise<Page<Lead>>;
  getLeadCounts(today: string): Promise<LeadCounts>;
  updateLead(id: string, patch: Partial<Pick<Lead, "status" | "assignedTo" | "followUpOn" | "notes">>): Promise<void>;
  /** Every reference issued on a date stamp, so the next one continues it. */
  leadIdsFor(stamp: string): Promise<string[]>;

  listAvailability(carSlug?: string, filter?: AvailabilityFilter): Promise<Availability[]>;
  listAvailabilityPage(filter?: AvailabilityFilter, page?: number, pageSize?: number): Promise<Page<Availability>>;
  addAvailability(entry: Omit<Availability, "id">): Promise<Availability>;
  removeAvailability(id: string): Promise<void>;
}
