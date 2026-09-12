import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content", () => ({ getCatalog: vi.fn() }));
vi.mock("@/lib/hero-frames", () => ({ getHeroFrames: async () => [] }));
vi.mock("@/lib/service-content", () => ({ getServicePage: async () => ({ data: [], total: 0 }), getServices: async () => [] }));

import { getCatalog, type Catalog } from "@/lib/content";
import { tripDefaults } from "@/lib/catalog";
import HomePage from "@/app/page";
import { LivePricing } from "./LivePricing";

const completeCatalog: Catalog = {
  live: true,
  cars: [{
    slug: "sedan", name: "Test sedan", year: 2026, type: "Sedan", seats: 4,
    transmission: "Automatic", fuel: "Petrol", homeCitySlug: "kochi", garageSlug: null,
    serviceCitySlugs: [], rating: "4.5", badge: "", rate8h: 1000, rate12h: 1500,
    rateFull: 2000, extraKmRate: 10, extraHrRate: 100, bata: 100, nightCharge: 100,
    occasions: ["casual"], images: [],
  }],
  cities: [{ slug: "kochi", name: "Kochi", state: "Kerala", multiplier: 1,
    carCount: 1, lat: 9.93, lng: 76.26, heroImage: null, seoTitle: null, seoDescription: null }],
  packages: [{ slug: "8h", label: "8 hrs / 80 km", hours: 8, km: 80, rateKey: "rate_8h", sub: "", icon: "" }],
  occasions: [{
    slug: "casual", name: "Casual", icon: "", tagline: "", surcharge: 0, handlingNote: "",
    kicker: "", title: "", blurb: "", h2: "", fleetTitle: "", ctaTitle: "", note: "",
    heroImage: null, includes: [], packages: [],
  }],
  locations: [], garages: [], carTypes: ["Sedan"], cityRoutes: [], seasons: [],
  settings: {
    whatsappNumber: "919876543210", phoneDisplay: "+91 98765 43210", email: "test@example.com",
    gstPercent: 5, advancePercent: 25, circuityFactor: 1.25,
    pricingRules: { localSpeedKph: 35, outstationSpeedKph: 55, oneWayReturnPercent: 50, nightStartHour: 22, nightEndHour: 6, minimumLegKm: 6 },
    inclusions: [], exclusions: [], whyItems: [], charges: [],
  },
};

describe("homepage live pricing with a newly migrated database", () => {
  it("renders the entire homepage with empty live tables and one clear contact option", async () => {
    const catalog = { ...completeCatalog, cars: [], cities: [], packages: [], occasions: [] };
    vi.mocked(getCatalog).mockResolvedValue(catalog);
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain("Luxury cars.");
    expect(html).toContain('id="journey-search"');
    expect(html.match(/Online pricing is currently unavailable/g)).toHaveLength(1);
    expect(html).not.toContain('id="live-car"');
    expect(html).not.toContain("Featured cars");
  });

  it.each(["cars", "cities", "packages", "occasions"] as const)(
    "renders a contact option instead of a quote when %s is empty",
    (field) => {
      const catalog = { ...completeCatalog, live: true, [field]: [] };
      const html = renderToStaticMarkup(<LivePricing catalog={catalog} initialTrip={tripDefaults(catalog, "2026-09-13")} />);
      expect(html).toContain("Online pricing is currently unavailable");
      expect(html).toContain('href="/contact"');
      expect(html).not.toContain("all-in");
      expect(html).not.toContain("live-car");
    },
  );

  it("does not price a vehicle using another city's rate when its home city is missing", () => {
    const catalog = {
      ...completeCatalog,
      cities: completeCatalog.cities.filter((city) => city.slug !== completeCatalog.cars[0].homeCitySlug),
    };
    const html = renderToStaticMarkup(<LivePricing catalog={catalog} initialTrip={tripDefaults(catalog, "2026-09-13")} />);
    expect(html).toContain("Online pricing is currently unavailable");
  });

  it("shows a base package rate without inventing a trip when the catalog is configured", () => {
    const html = renderToStaticMarkup(<LivePricing catalog={completeCatalog} initialTrip={tripDefaults(completeCatalog, "2026-09-13")} />);
    expect(html).toContain(completeCatalog.cars[0].name);
    expect(html).toContain("Base package");
    expect(html).toContain("Choose your pickup, drop, date and time");
    expect(html).not.toContain("all-in");
    expect(html).not.toContain("Online pricing is currently unavailable");
  });
});
