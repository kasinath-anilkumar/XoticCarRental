/**
 * The Supabase store — the same interface, against the real tables.
 *
 * It reads and writes the columns 0004/0007/0009 define, and maps them to the
 * domain shapes so nothing above `lib/store` knows which implementation
 * answered. Adding credentials to the environment is the entire migration:
 * `getStore()` picks this one and the local file stops being consulted.
 *
 * Writes go through the service-role client, exactly as the enquiry route did
 * before: the enquiries table has no anonymous policy at all, so there is no
 * public endpoint on which a lead could be read or forged.
 */

import { createSupabaseAdminClient } from "../supabase/admin";
import { leadPrefix, OPEN_STATUSES, type LeadStatus } from "../leads";
import { pagination } from "./pagination";
import type { Availability, Lead, LeadDetail, LeadFilter, LeadLine, LeadStop, Store } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function toLead(row: any): Lead {
  return {
    id: row.id,
    leadId: row.lead_id ?? "",
    createdAt: row.created_at,
    customerName: row.customer_name ?? null,
    customerPhone: row.customer_phone ?? null,
    customerPlace: row.customer_place ?? null,
    serviceSlug: row.service_slug ?? row.occasions?.slug ?? "",
    serviceName: row.service_name ?? row.occasions?.name ?? "",
    carSlug: row.cars?.slug ?? null,
    carName: row.cars?.name ?? null,
    packageLabel: row.packages?.label ?? null,
    tripType: row.trip_type ?? "",
    stops: (row.stops ?? []) as LeadStop[],
    pickupDate: row.pickup_date ?? "",
    pickupTime: row.pickup_time ?? "",
    haltHours: Number(row.halt_hours ?? 0),
    km: row.km,
    transferKm: row.transfer_km ?? 0,
    hours: Number(row.hours),
    days: row.days,
    lines: (row.lines ?? []) as LeadLine[],
    subtotal: Number(row.subtotal),
    gst: Number(row.gst),
    total: Number(row.total),
    advance: Number(row.advance),
    status: row.status as LeadStatus,
    assignedTo: row.assigned_to ?? null,
    followUpOn: row.follow_up_on ?? null,
    notes: row.notes ?? null,
    source: row.source ?? "summary",
    details: (row.details ?? []) as LeadDetail[],
  };
}

const SELECT =
  "*, cars(slug, name), packages(label), occasions(slug, name)";

function toAvailability(row: any): Availability {
  return { id: row.id, carSlug: row.cars?.slug ?? "", status: row.status,
    startsOn: row.starts_on, endsOn: row.ends_on, note: row.note ?? null,
    leadId: row.enquiry_id ?? null };
}

export function createSupabaseStore(): Store {
  return {
    kind: "supabase",

    async createLead(lead) {
      const supabase = createSupabaseAdminClient();

      // The catalog is keyed by slug and the tables by id, so the ids are
      // looked up rather than carried around the app.
      const occasionSlug = lead.occasionSlug ?? lead.serviceSlug;
      const [car, pkg, occasion, reference] = await Promise.all([
        lead.carSlug ? supabase.from("cars").select("id").eq("slug", lead.carSlug).single() : null,
        lead.packageLabel ? supabase.from("packages").select("id").eq("label", lead.packageLabel).single() : null,
        supabase.from("occasions").select("id").eq("slug", occasionSlug).maybeSingle(),
        supabase.rpc("allocate_lead_reference", { p_prefix: leadPrefix(lead.serviceSlug) }),
      ]);
      for (const result of [car, pkg, occasion, reference]) {
        if (result?.error) throw result.error;
      }
      if (typeof reference.data !== "string") throw new Error("Could not allocate a lead reference.");

      const { data, error } = await supabase
        .from("enquiries")
        .insert({
          lead_id: reference.data,
          customer_name: lead.customerName,
          customer_phone: lead.customerPhone,
          customer_place: lead.customerPlace,
          car_id: car?.data?.id ?? null,
          package_id: pkg?.data?.id ?? null,
          service_slug: lead.serviceSlug,
          service_name: lead.serviceName,
          details: lead.details ?? [],
          occasion_id: occasion.data?.id ?? null,
          // A service enquiry carries no route. Empty is written as NULL so the
          // trip_type check has nothing to reject.
          trip_type: lead.tripType || null,
          stops: lead.stops,
          from_place: lead.stops[0]?.name ?? null,
          to_place: lead.stops.at(-1)?.name ?? null,
          pickup_date: lead.pickupDate || null,
          pickup_time: lead.pickupTime || null,
          halt_hours: lead.haltHours,
          km: lead.km,
          transfer_km: lead.transferKm,
          hours: lead.hours,
          days: lead.days,
          lines: lead.lines,
          subtotal: lead.subtotal,
          gst: lead.gst,
          total: lead.total,
          advance: lead.advance,
          status: lead.status,
          assigned_to: lead.assignedTo,
          follow_up_on: lead.followUpOn,
          notes: lead.notes,
          source: lead.source,
        })
        .select(SELECT)
        .single();

      if (error) throw error;
      return toLead(data);
    },

    async listLeads(filter: LeadFilter = {}) {
      return (await this.listLeadsPage(filter, 1, 100)).items;
    },

    async listLeadsPage(filter: LeadFilter = {}, page, pageSize) {
      const supabase = createSupabaseAdminClient();
      const bounds = pagination(page, pageSize);
      let query = supabase.from("enquiries").select(SELECT, { count: "exact" })
        .order("created_at", { ascending: false }).order("id", { ascending: false });

      if (filter.status === "open") query = query.in("status", OPEN_STATUSES);
      else if (filter.status && filter.status !== "all") query = query.eq("status", filter.status);
      if (filter.assignedTo) query = query.eq("assigned_to", filter.assignedTo);
      if (filter.overdueOn) query = query.lte("follow_up_on", filter.overdueOn);

      const { data, error, count } = await query.range(bounds.offset, bounds.offset + bounds.pageSize - 1);
      if (error) throw error;
      return { items: (data ?? []).map(toLead), total: count ?? 0, page: bounds.page, pageSize: bounds.pageSize };
    },

    async getLeadCounts(today) {
      const supabase = createSupabaseAdminClient();
      const responses = await Promise.all([
        supabase.from("enquiries").select("id", { count: "exact", head: true }),
        supabase.from("enquiries").select("id", { count: "exact", head: true }).in("status", OPEN_STATUSES),
        supabase.from("enquiries").select("id", { count: "exact", head: true }).in("status", OPEN_STATUSES).lte("follow_up_on", today),
      ]);
      for (const response of responses) if (response.error) throw response.error;
      return { all: responses[0].count ?? 0, open: responses[1].count ?? 0, overdue: responses[2].count ?? 0 };
    },

    async updateLead(id, patch) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase
        .from("enquiries")
        .update({
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.assignedTo !== undefined ? { assigned_to: patch.assignedTo } : {}),
          ...(patch.followUpOn !== undefined ? { follow_up_on: patch.followUpOn } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },

    async leadIdsFor(stamp) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase.from("enquiries").select("lead_id").like("lead_id", `%-${stamp}-%`);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.lead_id).filter(Boolean);
    },

    async listAvailability(carSlug, filter = {}) {
      const supabase = createSupabaseAdminClient();
      carSlug ??= filter.carSlug;
      let carId: string | undefined;
      if (carSlug) {
        const car = await supabase.from("cars").select("id").eq("slug", carSlug).maybeSingle();
        if (car.error) throw car.error;
        if (!car.data) return [];
        carId = car.data.id;
      }
      // Availability must be complete: a server row cap must never make a held car look free.
      const entries: Availability[] = [];
      let cursor: string | undefined;
      for (;;) {
        let query = supabase.from("car_availability").select("id,status,starts_on,ends_on,note,enquiry_id,cars(slug)")
          .order("id").limit(500);
        if (cursor) query = query.gt("id", cursor);
        if (carId) query = query.eq("car_id", carId);
        if (filter.from) query = query.gte("ends_on", filter.from);
        if (filter.to) query = query.lte("starts_on", filter.to);
        if (filter.pastBefore) query = query.lt("ends_on", filter.pastBefore);
        const { data, error } = await query;
        if (error) throw error;
        entries.push(...(data ?? []).map(toAvailability));
        if (!data?.length) break;
        cursor = data[data.length - 1].id;
      }
      return entries.sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id));
    },

    async listAvailabilityPage(filter = {}, page, pageSize) {
      const bounds = pagination(page, pageSize);
      const supabase = createSupabaseAdminClient();
      let query = supabase.from("car_availability")
        .select("id,status,starts_on,ends_on,note,enquiry_id,cars(slug)", { count: "exact" })
        .order("starts_on").order("id").range(bounds.offset, bounds.offset + bounds.pageSize - 1);
      if (filter.carSlug) {
        const car = await supabase.from("cars").select("id").eq("slug", filter.carSlug).maybeSingle();
        if (car.error) throw car.error;
        if (!car.data) return { items: [], total: 0, page: bounds.page, pageSize: bounds.pageSize };
        query = query.eq("car_id", car.data.id);
      }
      if (filter.from) query = query.gte("ends_on", filter.from);
      if (filter.to) query = query.lte("starts_on", filter.to);
      if (filter.pastBefore) query = query.lt("ends_on", filter.pastBefore);
      const { data, error, count } = await query;
      if (error) throw error;
      return { items: (data ?? []).map(toAvailability), total: count ?? 0, page: bounds.page, pageSize: bounds.pageSize };
    },

    async addAvailability(entry) {
      const supabase = createSupabaseAdminClient();
      const car = await supabase.from("cars").select("id").eq("slug", entry.carSlug).maybeSingle();
      if (car.error) throw car.error;
      if (!car.data) throw new Error("Unknown vehicle.");
      const { data, error } = await supabase
        .from("car_availability")
        .insert({
          car_id: car.data?.id,
          status: entry.status,
          starts_on: entry.startsOn,
          ends_on: entry.endsOn,
          note: entry.note,
          enquiry_id: entry.leadId,
        })
        .select("*, cars(slug)")
        .single();
      if (error) throw error;
      return {
        id: data.id,
        carSlug: entry.carSlug,
        status: entry.status,
        startsOn: entry.startsOn,
        endsOn: entry.endsOn,
        note: entry.note,
        leadId: entry.leadId,
      };
    },

    async removeAvailability(id) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("car_availability").delete().eq("id", id);
      if (error) throw error;
    },
  };
}
