import { describe, expect, it } from "vitest";

import { dedupe, detailLine, iconForKind, kindFromOsm, rankPlaces } from "./normalize";
import type { GeoPlace } from "./types";

/**
 * The rules that turn a provider's answer into a list a customer can pick from.
 * The fixtures are real shapes: Photon genuinely returns Kalpetta three times,
 * and Nominatim genuinely answers "Munn" with a road.
 */

function place(partial: Partial<GeoPlace> & { name: string }): GeoPlace {
  return {
    id: partial.id ?? `id:${partial.name}`,
    name: partial.name,
    lat: partial.lat ?? 11.6,
    lng: partial.lng ?? 76.08,
    detail: partial.detail ?? "",
    state: partial.state ?? "Kerala",
    kind: partial.kind ?? "village",
  };
}

describe("kindFromOsm", () => {
  it("reads the tag value first", () => {
    expect(kindFromOsm("place", "village")).toBe("village");
    expect(kindFromOsm("place", "hamlet")).toBe("village");
    expect(kindFromOsm("place", "city")).toBe("city");
  });

  it("falls back to the tag key", () => {
    expect(kindFromOsm("aeroway", "gate")).toBe("airport");
    expect(kindFromOsm("railway", "platform")).toBe("station");
    expect(kindFromOsm("highway", "primary")).toBe("address");
  });

  it("calls anything else a landmark", () => {
    expect(kindFromOsm("tourism", "resort")).toBe("landmark");
    expect(kindFromOsm(undefined, undefined)).toBe("landmark");
  });
});

describe("detailLine", () => {
  it("drops blanks, repeats and the name itself", () => {
    expect(detailLine([" ", "Munnar", undefined, "Munnar", "Idukki"], "Munnar")).toBe("Idukki");
  });

  it("ignores case and accents when matching the name", () => {
    expect(detailLine(["Rishīkesh", "Uttarakhand"], "Rishikesh")).toBe("Uttarakhand");
  });

  it("stops at three segments", () => {
    expect(detailLine(["a", "b", "c", "d"], "x")).toBe("a, b, c");
  });
});

describe("dedupe", () => {
  it("preserves distinct same-name villages only a few kilometres apart", () => {
    expect(dedupe([place({ name: "Nagar", lat: 11.601 }), place({ name: "Nagar", lat: 11.64 })])).toHaveLength(2);
  });
  it("collapses one place returned under several tags, keeping the best", () => {
    const results = dedupe([
      place({ name: "Kalpetta", kind: "landmark", lat: 11.607, lng: 76.083, detail: "" }),
      place({ name: "Kalpetta", kind: "town", lat: 11.609, lng: 76.081, detail: "Wayanad" }),
      place({ name: "Kalpetta", kind: "locality", lat: 11.61, lng: 76.08, detail: "Wayanad" }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]!.kind).toBe("town");
    expect(results[0]!.detail).toBe("Wayanad");
  });

  it("keeps the same name in a different part of the country", () => {
    const results = dedupe([
      place({ name: "Nagar", lat: 11.6, lng: 76.08 }),
      place({ name: "Nagar", lat: 27.5, lng: 79.2, state: "Uttar Pradesh" }),
    ]);

    expect(results).toHaveLength(2);
  });

  it("prefers the row that says where it is, all else equal", () => {
    const results = dedupe([
      place({ name: "Aluva", kind: "town", detail: "" }),
      place({ name: "Aluva", kind: "town", detail: "Ernakulam, Kerala" }),
    ]);

    expect(results[0]!.detail).toBe("Ernakulam, Kerala");
  });
});

describe("rankPlaces", () => {
  it("puts what was typed above what merely contains it", () => {
    const ranked = rankPlaces(
      [
        place({ name: "Munnarkode Road", kind: "address" }),
        place({ name: "Munnar", kind: "town" }),
      ],
      "munnar",
    );

    expect(ranked.map((p) => p.name)).toEqual(["Munnar", "Munnarkode Road"]);
  });

  it("ranks an airport with the cities, above a village", () => {
    const ranked = rankPlaces(
      [
        place({ name: "Cochin backwaters", kind: "village" }),
        place({ name: "Cochin International Airport", kind: "airport" }),
      ],
      "cochin",
    );

    expect(ranked[0]!.kind).toBe("airport");
  });

  it("brings the nearer of two equals forward", () => {
    const ranked = rankPlaces(
      [
        place({ name: "Kalpetta", kind: "town", lat: 27.5, lng: 79.2 }),
        place({ name: "Kalpetta", kind: "town", lat: 11.6, lng: 76.08 }),
      ],
      "kalpetta",
      { lat: 11.5, lng: 76.0 },
    );

    expect(ranked[0]!.lat).toBeCloseTo(11.6);
  });

  it("leaves the provider's own order alone within a tier", () => {
    const ranked = rankPlaces(
      [place({ name: "Aluva", kind: "town" }), place({ name: "Aluva Junction", kind: "town" })],
      "aluva",
    );

    expect(ranked.map((p) => p.name)).toEqual(["Aluva", "Aluva Junction"]);
  });
});

describe("iconForKind", () => {
  it("maps every kind to an icon the set actually has", () => {
    expect(iconForKind("airport")).toBe("ph-airplane-tilt");
    expect(iconForKind("station")).toBe("ph-train");
    expect(iconForKind("city")).toBe("ph-city");
    expect(iconForKind(undefined)).toBe("ph-map-pin");
  });
});
