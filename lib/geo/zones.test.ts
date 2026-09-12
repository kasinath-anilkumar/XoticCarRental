import { describe, expect, it } from "vitest";

import { filterByZone, STATE_TO_ZONE, ZONES } from "./zones";

describe("India Zones mapping", () => {
  it("defines all major geographical zones", () => {
    const keys = ZONES.map((z) => z.key);
    expect(keys).toEqual(["all", "north", "west", "south", "east_central"]);
  });

  it("correctly maps northern states and UTs", () => {
    expect(STATE_TO_ZONE["Delhi"]).toBe("north");
    expect(STATE_TO_ZONE["Punjab"]).toBe("north");
    expect(STATE_TO_ZONE["Rajasthan"]).toBe("north");
    expect(STATE_TO_ZONE["Uttar Pradesh"]).toBe("north");
  });

  it("correctly maps southern states", () => {
    expect(STATE_TO_ZONE["Karnataka"]).toBe("south");
    expect(STATE_TO_ZONE["Kerala"]).toBe("south");
    expect(STATE_TO_ZONE["Tamil Nadu"]).toBe("south");
    expect(STATE_TO_ZONE["Telangana"]).toBe("south");
  });

  it("correctly maps western states", () => {
    expect(STATE_TO_ZONE["Maharashtra"]).toBe("west");
    expect(STATE_TO_ZONE["Gujarat"]).toBe("west");
    expect(STATE_TO_ZONE["Goa"]).toBe("west");
  });

  it("correctly maps eastern and central states", () => {
    expect(STATE_TO_ZONE["West Bengal"]).toBe("east_central");
    expect(STATE_TO_ZONE["Odisha"]).toBe("east_central");
    expect(STATE_TO_ZONE["Madhya Pradesh"]).toBe("east_central");
  });

  it("filters items by zone correctly", () => {
    const hubs = [
      { name: "Delhi NCR", state: "Delhi" },
      { name: "Bengaluru", state: "Karnataka" },
      { name: "Mumbai", state: "Maharashtra" },
      { name: "Kolkata", state: "West Bengal" },
    ];

    expect(filterByZone(hubs, "all")).toHaveLength(4);
    expect(filterByZone(hubs, "north")).toEqual([{ name: "Delhi NCR", state: "Delhi" }]);
    expect(filterByZone(hubs, "south")).toEqual([{ name: "Bengaluru", state: "Karnataka" }]);
    expect(filterByZone(hubs, "west")).toEqual([{ name: "Mumbai", state: "Maharashtra" }]);
    expect(filterByZone(hubs, "east_central")).toEqual([{ name: "Kolkata", state: "West Bengal" }]);
  });
});
