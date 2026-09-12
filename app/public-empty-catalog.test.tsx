import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCatalog, getStore, resolveRoutedQuote, isSupabaseConfigured, canRecordEnquiries } = vi.hoisted(() => ({
  getCatalog: vi.fn(), getStore: vi.fn(), resolveRoutedQuote: vi.fn(),
  isSupabaseConfigured: vi.fn(), canRecordEnquiries: vi.fn(),
}));
vi.mock("@/lib/content", () => ({ getCatalog }));
vi.mock("@/lib/store", () => ({ getStore }));
vi.mock("@/lib/quote-server", () => ({ resolveRoutedQuote }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured }));
vi.mock("@/lib/supabase/admin", () => ({ canRecordEnquiries }));

import BrowsePage from "./cars/page";
import CarPage, { generateMetadata as carMetadata } from "./cars/[slug]/page";
import CalculatorPage from "./price-calculator/page";
import SummaryPage from "./booking-summary/page";
import CitiesPage from "./cities/page";
import CityPage, { generateMetadata as cityMetadata } from "./cities/[slug]/page";
import ServicesPage from "./services/page";
import ServicePage from "./services/[slug]/page";
import ServiceCityPage, { generateMetadata as serviceCityMetadata } from "./services/[slug]/[city]/page";
import PackagesPage from "./packages/page";

const params = Promise.resolve({ date: "2026-10-15", city: "kochi", occasion: "wedding" });
const carParams = Promise.resolve({ slug: "eclass" });
const cityParams = Promise.resolve({ slug: "kochi" });
const serviceParams = Promise.resolve({ slug: "wedding" });
const serviceCityParams = Promise.resolve({ slug: "wedding", city: "kochi" });

function partialCatalog() {
  return {
    live: true,
    cars: [{ slug: "eclass", name: "E-Class", homeCitySlug: "kochi" }],
    cities: [{ slug: "kochi", name: "Kochi", state: "Kerala" }],
    packages: [{ slug: "8h" }], occasions: [{ slug: "wedding" }],
    locations: [], garages: [], cityRoutes: [], seasons: [], carTypes: [], settings: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isSupabaseConfigured.mockReturnValue(true);
  canRecordEnquiries.mockReturnValue(true);
  getStore.mockImplementation(() => { throw new Error("Availability must not load without pricing"); });
  resolveRoutedQuote.mockImplementation(() => { throw new Error("A partial catalog must not produce a quote"); });
});

describe("public pages with an incomplete live catalog", () => {
  it.each(["cars", "packages", "occasions", "homeCity"] as const)(
    "renders a contact path without prices when %s are unavailable", async (missing) => {
      const catalog = partialCatalog();
      if (missing === "homeCity") catalog.cars[0].homeCitySlug = "unpublished-city";
      else catalog[missing] = [];
      getCatalog.mockResolvedValue(catalog);

      const pages = [
        BrowsePage({ searchParams: params }), CalculatorPage({ searchParams: params }),
        SummaryPage({ searchParams: params }), CitiesPage(),
        CityPage({ params: cityParams }), ServicesPage(), ServicePage({ params: serviceParams }),
        ServiceCityPage({ params: serviceCityParams }), PackagesPage(),
        ...(missing === "cars" ? [] : [CarPage({ params: carParams })]),
      ];
      for (const page of await Promise.all(pages)) {
        const html = renderToStaticMarkup(page);
        expect(html).toContain("<h1");
        expect(html).toContain("Online pricing is currently unavailable");
        expect(html).toContain('href="/contact"');
        // Budget choices inside an enquiry are customer preferences, not rates.
        expect(html.replace(/<form\b[\s\S]*?<\/form>/g, "").includes("₹")).toBe(false);
      }
      expect(getStore).not.toHaveBeenCalled();
      expect(resolveRoutedQuote).not.toHaveBeenCalled();
    },
  );

  it("keeps service enquiries usable without publishing sample package prices", async () => {
    getCatalog.mockResolvedValue({ ...partialCatalog(), packages: [] });
    const html = renderToStaticMarkup(await ServicePage({ params: serviceParams }));
    expect(html).toContain('name="customerPhone"');
    expect(html).toContain("Send Enquiry on WhatsApp");
    expect(html.replace(/<form\b[\s\S]*?<\/form>/g, "").includes("₹")).toBe(false);
  });

  it("generates car and city metadata without calculating missing rates", async () => {
    getCatalog.mockResolvedValue({ ...partialCatalog(), packages: [] });
    const metadata = await Promise.all([
      carMetadata({ params: carParams }), cityMetadata({ params: cityParams }),
      serviceCityMetadata({ params: serviceCityParams }),
    ]);
    expect(metadata.every((entry) => Boolean(entry.title))).toBe(true);
    expect(JSON.stringify(metadata)).not.toContain("₹");
  });

  it("preserves configured-database failures instead of replacing them with an empty state", async () => {
    getCatalog.mockResolvedValue({ ...partialCatalog(), live: false, cars: [] });
    await expect(CalculatorPage({ searchParams: params })).rejects.toThrow("Live pricing is temporarily unavailable");
    await expect(SummaryPage({ searchParams: params })).rejects.toThrow("Live pricing is temporarily unavailable");
  });
});
