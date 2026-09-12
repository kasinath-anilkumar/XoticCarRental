import { beforeEach, describe, expect, it, vi } from "vitest";
import seed from "@/backend/service-seed-data.json";

const mock = vi.hoisted(() => ({ requireAdmin: vi.fn(), from: vi.fn(), writes: vi.fn(), updateTag: vi.fn(), redirect: vi.fn() }));
vi.mock("next/cache", () => ({ updateTag: mock.updateTag, revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mock.redirect }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: mock.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ from: mock.from }) }));
import { saveService } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mock.requireAdmin.mockResolvedValue({ userId: "staff" });
  mock.from.mockImplementation((table) => {
    let values: unknown;
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query),
      insert: vi.fn((value) => { values = value; mock.writes(table, value); return query; }),
      update: vi.fn((value) => { values = value; mock.writes(table, value); return query; }),
      maybeSingle: vi.fn(async () => ({ data: table === "occasions" ? { slug: "configured-occasion" } : { name: "Configured type" }, error: null })),
      single: vi.fn(async () => ({ data: values ? { id: "stored" } : { slug: "wedding" }, error: null })),
    };
    return query;
  });
});

function form(definition: unknown = seed[0]) {
  const result = new FormData();
  result.set("id", "stored"); result.set("definition", JSON.stringify(definition));
  result.set("occasion_id", "saved-occasion"); result.set("car_type_id", "saved-type"); result.set("sort", "3");
  return result;
}

describe("service content mutation", () => {
  it("requires staff access before database work", async () => {
    mock.requireAdmin.mockRejectedValue(new Error("Sign in"));
    await expect(saveService(null, form())).rejects.toThrow("Sign in");
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("resolves real reference IDs and invalidates public content after a draft edit", async () => {
    expect((await saveService(null, form())).ok).toBe(true);
    expect(mock.writes).toHaveBeenCalledWith("services", expect.objectContaining({ is_active: false, sort: 3,
      definition: expect.objectContaining({ occasionSlug: "configured-occasion", carFilter: expect.objectContaining({ type: "Configured type" }) }) }));
    expect(mock.updateTag).toHaveBeenCalledWith("public-catalog");
  });
  it("rejects unsafe questions and does not replace the saved service", async () => {
    expect((await saveService(null, form({ ...seed[0], fields: [{ name: "constructor", type: "text", label: "Invalid" }] }))).ok).toBe(false);
    expect(mock.writes).not.toHaveBeenCalled();
    expect(mock.updateTag).not.toHaveBeenCalled();
  });
  it("preserves existing service URLs", async () => {
    expect((await saveService(null, form({ ...seed[0], slug: "changed-link" }))).ok).toBe(false);
    expect(mock.writes).not.toHaveBeenCalled();
  });
  it("redirects a newly created service to its editor", async () => {
    const values = form(); values.delete("id");
    await saveService(null, values);
    expect(mock.redirect).toHaveBeenCalledWith("/admin/services/wedding");
  });
});
