import { describe, expect, it } from "vitest";
import { decodeFreePlace, encodeFreePlace, suggestionFromGeo } from "./places";

describe("coordinate place tokens", () => {
  it.each(["@,77,Nowhere", "@10,,Nowhere", "@0x10,77,Nowhere", "@91,77,Nowhere", "@10,181,Nowhere", "@10,77,", "@10,77,A~B", `@10,77,${"x".repeat(161)}`])("rejects malformed token %s", (token) => {
    expect(decodeFreePlace(token)).toBeNull();
  });
  it("round trips commas and sanitises itinerary delimiters", () => {
    const token = encodeFreePlace({ name: "Gate ~ east, Kerala", lat: 10.123456, lng: 76.23 });
    expect(decodeFreePlace(token)).toMatchObject({ name: "Gate   east, Kerala", lat: 10.12346, lng: 76.23 });
  });
  it("refuses invalid encoder coordinates", () => {
    expect(() => encodeFreePlace({ name: "Unknown", lat: Infinity, lng: 1 })).toThrow();
  });
  it("keeps provider context separate from the shareable token", () => {
    expect(suggestionFromGeo({ id: "osm:1", name: "Kakkanad", lat: 10, lng: 76, state: "Kerala", city: "Kochi", countryCode: "IN", kind: "suburb", detail: "Kochi, Kerala" })).toMatchObject({ state: "Kerala", city: "Kochi", countryCode: "IN", providerId: "osm:1" });
  });
});
