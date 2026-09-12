import { describe, expect, it, vi } from "vitest";

import { pageBounds, pageHref, parsePage, readKeysetPages } from "./pagination";
import { parseBrowseDate } from "./catalog";

describe("pagination", () => {
  it("rejects malformed or unsafe page offsets", () => {
    for (const value of [undefined, "", "0", "-1", "1.5", "1e3", "Infinity", "9007199254740993"]) {
      expect(parsePage(value)).toBe(1);
    }
    expect(parsePage(["3", "9"])).toBe(3);
  });

  it("clamps an old bookmark after filtering while retaining the last partial page", () => {
    expect(pageBounds(27, 9, 12)).toEqual({ page: 3, pageCount: 3, offset: 24, from: 25, to: 27 });
    expect(pageBounds(0, 9, 12)).toEqual({ page: 1, pageCount: 1, offset: 0, from: 0, to: 0 });
  });

  it("preserves filters and trip context in pagination links", () => {
    const href = pageHref("/cars", "city=kochi&pkg=8h&date=2026-09-14&page=4", 2);
    expect(href).toBe("/cars?city=kochi&pkg=8h&date=2026-09-14&page=2");
    expect(pageHref("/cars", "page=2", 1)).toBe("/cars");
  });

  it("reads all batches even when the database caps them below our limit", async () => {
    const load = vi.fn(async (after: string | undefined) => {
      if (!after) return [{ id: "a" }, { id: "b" }];
      if (after === "b") return [{ id: "c" }];
      return [];
    });
    expect(await readKeysetPages(load)).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(load.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, "b", "c"]);
  });

  it("fails when a cursor stops advancing instead of looping forever", async () => {
    await expect(readKeysetPages(async () => [{ id: "a" }])).rejects.toThrow("did not advance");
  });
});

describe("browse dates", () => {
  it("rejects impossible dates before sending them to the database", () => {
    for (const date of [undefined, "tomorrow", "2026-02-29", "2026-04-31", "2026-13-01", "2026-09-01T00:00:00Z"]) {
      expect(parseBrowseDate(date)).toBe("");
    }
    expect(parseBrowseDate("2028-02-29")).toBe("2028-02-29");
    expect(parseBrowseDate("2026-09-12")).toBe("2026-09-12");
  });
});
