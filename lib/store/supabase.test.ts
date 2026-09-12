import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseAdminClient } = vi.hoisted(() => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("../supabase/admin", () => ({ createSupabaseAdminClient }));
import { createSupabaseStore } from "./supabase";

beforeEach(() => vi.clearAllMocks());

describe("Supabase availability reads", () => {
  it("keeps cursor paging until empty when the server row cap is smaller than the requested batch", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: String(index + 1).padStart(3, "0"), status: "hold", starts_on: "2026-10-01", ends_on: "2026-10-02", cars: { slug: "sedan" },
    }));
    const cursors: Array<string | undefined> = [];
    createSupabaseAdminClient.mockImplementation(() => ({
      from: () => {
        let cursor: string | undefined;
        const query = {
          select: () => query, order: () => query, limit: () => query,
          eq: () => query, gte: () => query, lte: () => query,
          gt: (_field: string, value: string) => { cursor = value; return query; },
          // PostgREST query builders deliberately implement PromiseLike.
          // oxlint-disable-next-line unicorn/no-thenable
          then: (resolve: (value: unknown) => unknown) => {
            cursors.push(cursor);
            // Simulate a PostgREST installation capped to two returned rows.
            return Promise.resolve(resolve({ data: rows.filter((row) => !cursor || row.id > cursor).slice(0, 2), error: null }));
          },
        };
        return query;
      },
    }));
    const entries = await createSupabaseStore().listAvailability(undefined, { from: "2026-10-01", to: "2026-10-02" });
    expect(entries).toHaveLength(5);
    expect(cursors).toEqual([undefined, "002", "004", "005"]);
  });

  it("does not interpret a failed vehicle lookup as an empty, available calendar", async () => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: null, error: new Error("database unavailable") }),
    };
    createSupabaseAdminClient.mockReturnValue({ from: () => query });
    await expect(createSupabaseStore().listAvailability("sedan")).rejects.toThrow("database unavailable");
  });
});
