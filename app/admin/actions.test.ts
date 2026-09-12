import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ updateTag: mocks.updateTag, revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/store", () => ({ getStore: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc }),
}));

import { updateCar } from "./actions";
import { PUBLIC_CATALOG_TAG } from "@/lib/catalog-cache";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ userId: "staff" });
  mocks.rpc.mockResolvedValue({ error: null });
});

function carForm() {
  const form = new FormData();
  form.set("id", "car-id");
  form.set("slug", "test-car");
  form.set("name", "Test car");
  form.append("occasion_ids", "occasion-id");
  form.append("occasion_ids", "occasion-id");
  form.append("service_city_ids", "city-id");
  return form;
}

describe("fleet mutation cache invalidation", () => {
  it("accepts the vintage fleet's 1957 model year", async () => {
    const form = carForm();
    form.set("year", "1957");
    expect((await updateCar(null, form)).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("save_car_details", expect.objectContaining({
      p_values: expect.objectContaining({ year: 1957 }),
    }));
  });

  it.each(["1899", "2101", "1957.5", "not-a-year"])("rejects invalid model year %s before writing", async (year) => {
    const form = carForm();
    form.set("year", year);
    expect(await updateCar(null, form)).toEqual({ ok: false, message: "Vehicle year must be a whole number between 1900 and 2100." });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("saves the full edit atomically before invalidating the shared catalog", async () => {
    const result = await updateCar(null, carForm());
    expect(result.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("save_car_details", expect.objectContaining({
      p_car_id: "car-id",
      p_occasion_ids: ["occasion-id"],
      p_service_city_ids: ["city-id"],
      p_values: expect.objectContaining({ name: "Test car", year: 2020, seats: 4 }),
    }));
    expect(mocks.updateTag).toHaveBeenCalledWith(PUBLIC_CATALOG_TAG);
    expect(mocks.updateTag.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/cars/test-car");
  });

  it("retains the last public catalog when the database rejects an edit", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "A selected city no longer exists." } });
    const result = await updateCar(null, carForm());
    expect(result).toEqual({ ok: false, message: "A selected city no longer exists." });
    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not write or invalidate data before authorizing the staff member", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Access denied"));
    await expect(updateCar(null, carForm())).rejects.toThrow("Access denied");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
