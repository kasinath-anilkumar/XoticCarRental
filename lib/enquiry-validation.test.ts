import { afterEach, describe, expect, it, vi } from "vitest";
import { inputDate, inputPhone, readEnquiryBody } from "./enquiry-validation";
import { createRateLimiter } from "./net/rate-limit";

afterEach(() => vi.useRealTimers());

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://xotic.example/api/enquiries", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
}

describe("enquiry request boundary", () => {
  it("accepts a same-origin JSON object", async () => {
    expect(await readEnquiryBody(request('{"service":"wedding"}', { origin: "https://xotic.example" }))).toEqual({ service: "wedding" });
  });
  it("rejects cross-origin writes, malformed JSON and array bodies", async () => {
    await expect(readEnquiryBody(request("{}", { origin: "https://other.example" }))).rejects.toMatchObject({ status: 403 });
    await expect(readEnquiryBody(request("{"))).rejects.toMatchObject({ status: 400 });
    await expect(readEnquiryBody(request("[]"))).rejects.toMatchObject({ status: 400 });
  });
  it("enforces the real streamed size when content-length is absent", async () => {
    await expect(readEnquiryBody(request(JSON.stringify({ notes: "x".repeat(17_000) })))).rejects.toMatchObject({ status: 413 });
  });
  it("requires an actual phone number and bounds calendar dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00Z"));
    expect(inputPhone("+91 98765 43210", true)).toBe("+91 98765 43210");
    expect(() => inputPhone("call me", true)).toThrow();
    expect(() => inputPhone("123", true)).toThrow();
    expect(() => inputDate("2026-02-30")).toThrow();
    expect(() => inputDate("2026-09-11")).toThrow();
    expect(inputDate("2026-09-13")).toBe("2026-09-13");
  });
});

describe("bounded request limiting", () => {
  it("caps fresh keys without evicting active clients or admitting unbounded memory", () => {
    vi.useFakeTimers();
    const allow = createRateLimiter(2, 1000, 2);
    expect(allow("a")).toBe(true);
    expect(allow("b")).toBe(true);
    expect(allow("c")).toBe(false);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(allow("c")).toBe(true);
  });
});
