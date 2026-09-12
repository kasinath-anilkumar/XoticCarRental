/**
 * The local store: one JSON file under `.data/`.
 *
 * It exists so the whole product can be used before Supabase does — an enquiry
 * captured here shows up in the dashboard, gets a follow-up date, and can be
 * assigned, which is the only way to know whether any of that works.
 *
 * Deliberately dumb: no daemon, no schema, no migration. Reads parse the file;
 * writes serialise the whole thing back. At the scale this is for — a few
 * hundred demo leads — that costs microseconds, and the file can be opened in
 * an editor when somebody asks what the site recorded.
 *
 * Writes are serialised through a promise chain, because two enquiries landing
 * together would otherwise read-modify-write over each other and lose one.
 *
 * Not for production, and it says so: it writes under `.data/`, which is
 * gitignored, and the admin shows which store answered.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import { nextLeadId, OPEN_STATUSES } from "../leads";
import { pagination } from "./pagination";
import type { Availability, AvailabilityFilter, Lead, LeadFilter, Store } from "./types";

interface FileShape {
  leads: Lead[];
  availability: Availability[];
}

async function read(file: string): Promise<FileShape> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<FileShape>;
    if (!Array.isArray(parsed.leads) || !Array.isArray(parsed.availability)) {
      throw new Error("Local store is malformed; refusing to overwrite existing data.");
    }
    return { leads: parsed.leads ?? [], availability: parsed.availability ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { leads: [], availability: [] };
    throw error;
  }
}

/**
 * Write to a sibling and rename over the original.
 *
 * A rename is atomic on every filesystem this will meet, so a crash mid-write
 * leaves the previous file intact rather than half a JSON document.
 */
async function write(file: string, data: FileShape): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
  await rename(temporary, file);
}

/** One writer at a time, whatever the request concurrency. */
let queue: Promise<unknown> = Promise.resolve();

function serialise<T>(file: string, work: (data: FileShape) => Promise<[FileShape, T]> | [FileShape, T]): Promise<T> {
  const next = queue.then(async () => {
    const data = await read(file);
    const [updated, result] = await work(data);
    await write(file, updated);
    return result;
  });
  // Keep the chain alive even if this link rejects, or one failed write would
  // block every write after it.
  queue = next.catch(() => undefined);
  return next;
}

function matchesLead(lead: Lead, filter: LeadFilter): boolean {
  return (!filter.status || filter.status === "all" ||
      (filter.status === "open" ? OPEN_STATUSES.includes(lead.status) : lead.status === filter.status)) &&
    (!filter.assignedTo || lead.assignedTo === filter.assignedTo) &&
    (!filter.overdueOn || (lead.followUpOn !== null && lead.followUpOn <= filter.overdueOn));
}

function matchesAvailability(entry: Availability, filter: AvailabilityFilter): boolean {
  return (!filter.carSlug || entry.carSlug === filter.carSlug) &&
    (!filter.from || entry.endsOn >= filter.from) &&
    (!filter.to || entry.startsOn <= filter.to) &&
    (!filter.pastBefore || entry.endsOn < filter.pastBefore);
}

export function createLocalStore(file = join(process.cwd(), ".data", "store.json")): Store {
  return {
    kind: "local",

    async createLead(lead) {
      return serialise(file, (data) => {
        const row: Lead = {
          ...lead,
          leadId: nextLeadId(lead.serviceSlug, new Date(), data.leads.map((item) => item.leadId)),
          details: lead.details ?? [],
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        };
        return [{ ...data, leads: [row, ...data.leads] }, row];
      });
    },

    async listLeads(filter: LeadFilter = {}) {
      const { leads } = await read(file);
      return leads
        // A file written before service enquiries existed has no details array,
        // and every reader is entitled to assume the shape is whole.
        .map((lead) => ({ ...lead, details: lead.details ?? [] }))
        .filter((lead) => matchesLead(lead, filter))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    },

    async listLeadsPage(filter = {}, page, pageSize) {
      const bounds = pagination(page, pageSize);
      const rows = await this.listLeads(filter);
      return { items: rows.slice(bounds.offset, bounds.offset + bounds.pageSize), total: rows.length, page: bounds.page, pageSize: bounds.pageSize };
    },

    async getLeadCounts(today) {
      const { leads } = await read(file);
      const open = leads.filter((lead) => OPEN_STATUSES.includes(lead.status));
      return { all: leads.length, open: open.length, overdue: open.filter((lead) => lead.followUpOn !== null && lead.followUpOn <= today).length };
    },

    async updateLead(id, patch) {
      await serialise(file, (data) => [
        {
          ...data,
          leads: data.leads.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)),
        },
        undefined,
      ]);
    },

    async leadIdsFor(stamp) {
      const { leads } = await read(file);
      return leads.map((lead) => lead.leadId).filter((id) => id.includes(`-${stamp}-`));
    },

    async listAvailability(carSlug, filter = {}) {
      const { availability } = await read(file);
      return availability
        .filter((entry) => !carSlug || entry.carSlug === carSlug)
        .filter((entry) => matchesAvailability(entry, filter))
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id));
    },

    async listAvailabilityPage(filter = {}, page, pageSize) {
      const bounds = pagination(page, pageSize);
      const rows = await this.listAvailability(undefined, filter);
      return { items: rows.slice(bounds.offset, bounds.offset + bounds.pageSize), total: rows.length, page: bounds.page, pageSize: bounds.pageSize };
    },

    async addAvailability(entry) {
      return serialise(file, (data) => {
        const row: Availability = { ...entry, id: randomUUID() };
        return [{ ...data, availability: [...data.availability, row] }, row];
      });
    },

    async removeAvailability(id) {
      await serialise(file, (data) => [
        { ...data, availability: data.availability.filter((entry) => entry.id !== id) },
        undefined,
      ]);
    },
  };
}
