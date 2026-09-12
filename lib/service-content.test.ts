import { beforeEach, describe, expect, it, vi } from "vitest";
import seed from "@/backend/service-seed-data.json";

const mock = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./supabase/server", () => ({ isSupabaseConfigured: () => true }));
vi.mock("./public-db", () => ({ createPublicClient: () => mock }));
vi.mock("./content", () => ({ getCatalog: async () => ({ carTypes: ["Published category"] }) }));
import { getService, getServicePage } from "./service-content";

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of [mock.from, mock.select, mock.eq, mock.order]) method.mockReturnValue(mock);
});

describe("published service reads", () => {
  it("keeps an empty live database empty instead of publishing embedded samples", async () => {
    mock.range.mockResolvedValue({ data: [], count: 0, error: null });
    expect(await getServicePage()).toMatchObject({ data: [], total: 0, from: 0, to: 0 });
    expect(mock.eq).toHaveBeenCalledWith("is_active", true);
  });
  it("propagates database failures instead of substituting sample business content", async () => {
    mock.range.mockResolvedValue({ data: null, count: null, error: new Error("Unavailable") });
    await expect(getServicePage()).rejects.toThrow("Unavailable");
  });
  it("paginates deterministically and hydrates choices from configured fleet types", async () => {
    mock.range.mockResolvedValue({ data: [{ definition: seed[0] }], count: 25, error: null });
    const page = await getServicePage(2, 24);
    expect(mock.range).toHaveBeenCalledWith(24, 47);
    expect(mock.order.mock.calls).toEqual([["sort"], ["slug"]]);
    expect(page).toMatchObject({ total: 25, page: 2, from: 25, to: 25 });
    expect(page.data[0].fields.find((field) => field.optionsSource === "carTypes")?.options).toEqual(["Published category"]);
  });
  it("clamps a page after services have been unpublished", async () => {
    mock.range.mockResolvedValueOnce({ data: [], count: 1, error: null })
      .mockResolvedValueOnce({ data: [{ definition: seed[0] }], count: 1, error: null });
    expect(await getServicePage(3)).toMatchObject({ page: 1, total: 1 });
    expect(mock.range.mock.calls).toEqual([[48, 71], [0, 23]]);
  });
  it("does not resolve unknown or unpublished slugs to a default service", async () => {
    mock.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getService("unknown-service")).toBeUndefined();
    expect(mock.eq).toHaveBeenCalledWith("slug", "unknown-service");
    expect(mock.eq).toHaveBeenCalledWith("is_active", true);
  });
});
