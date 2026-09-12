import type { Metadata } from "next";

import { Calculator } from "@/components/calculator/Calculator";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { tripDefaults } from "@/lib/catalog";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { tripFromParams } from "@/lib/quote";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { canRecordEnquiries } from "@/lib/supabase/admin";
import { businessDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Price calculator",
  description:
    "Build your trip and see the exact price: package, route distance, extra km and hours, driver bata, night charge and GST — itemised before you book.",
  alternates: { canonical: "/price-calculator" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PriceCalculatorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const catalog = await getCatalog();
  if ((isSupabaseConfigured() || canRecordEnquiries()) && !catalog.live) throw new Error("Live pricing is temporarily unavailable.");
  if (!isPricingAvailable(catalog)) {
    return <section className="sec"><h1 className="mb-6">Price calculator</h1><PricingUnavailable /></section>;
  }

  // Resolved on the server and handed down as a prop: reading the clock during
  // the client render would make the default pickup date differ between the
  // server HTML and the hydrated tree.
  const defaults = tripDefaults(catalog, "");
  const trip = tripFromParams(params, defaults);

  return <Calculator catalog={catalog} initialTrip={trip} minDate={businessDate()} />;
}
