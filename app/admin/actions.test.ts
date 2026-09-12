import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("next/cache", () => ({ updateTag: mocks.updateTag, revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/store", () => ({ getStore: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

import { createCity, createGarage, createLocation, updateCar, updateSettings } from "./actions";
import { PUBLIC_CATALOG_TAG } from "@/lib/catalog-cache";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ userId: "staff" });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue(mocks);
  mocks.insert.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue(mocks);
  mocks.eq.mockResolvedValue({ error: null });
});

function placeForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Configured place", state: "Configured state", lat: "12.34", lng: "75.67", city_id: "f7338c3c-0c3d-4a5e-9086-76e2d7e4c524", multiplier: "1.1", car_count: "0" })) form.set(key, value);
  return form;
}

describe("admin geographic records", () => {
  it.each([createCity, createGarage, createLocation])("rejects missing coordinates instead of storing an invented zero", async (action) => {
    const form = placeForm();
    form.set("lat", "");
    expect((await action(null, form)).ok).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(["NaN", "91", "-91"])("rejects invalid latitude %s", async (lat) => {
    const form = placeForm(); form.set("lat", lat);
    expect((await createLocation(null, form)).ok).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("requires explicit saved city selection", async () => {
    const form = placeForm(); form.delete("city_id");
    expect(await createGarage(null, form)).toEqual({ ok: false, message: "Choose a saved service city." });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("accepts explicitly entered zero coordinates and keeps new cities hidden", async () => {
    const form = placeForm(); form.set("lat", "0"); form.set("lng", "0");
    expect((await createCity(null, form)).ok).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ name: "Configured place", state: "Configured state", lat: 0, lng: 0, multiplier: 1.1, is_active: false }));
  });
  it("does not substitute a city pricing multiplier", async () => {
    const form = placeForm(); form.delete("multiplier");
    expect((await createCity(null, form)).ok).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("configured operating rules", () => {
  function settingsForm() {
    const form = new FormData();
    for (const [key, value] of Object.entries({ whatsapp_number: "919000000000", gst_percent: "8", advance_percent: "20", circuity_factor: "1.4", minimumLegKm: "9", localSpeedKph: "25", outstationSpeedKph: "60", oneWayReturnPercent: "40", nightStartHour: "21", nightEndHour: "5" })) form.set(key, value);
    return form;
  }
  it("writes explicitly submitted operating rules", async () => {
    expect((await updateSettings(null, settingsForm())).ok).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ pricing_rules: { minimumLegKm: 9, localSpeedKph: 25, outstationSpeedKph: 60, oneWayReturnPercent: 40, nightStartHour: 21, nightEndHour: 5 }, gst_percent: 8 }));
  });
  it("rejects an omitted or invalid rule before writing", async () => {
    const form = settingsForm(); form.delete("oneWayReturnPercent");
    expect((await updateSettings(null, form)).ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
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
