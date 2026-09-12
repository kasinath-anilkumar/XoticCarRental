/** Service content is stored in the database and edited in /admin/services. */

export type ServiceFieldType = "text" | "number" | "date" | "select" | "textarea" | "place";

export interface ServiceField {
  name: string;
  label: string;
  type: ServiceFieldType;
  /** Explicit choices; customers select their own answer. */
  options?: string[];
  /** Resolve choices from published business data instead of a fixed list. */
  optionsSource?: "carTypes";
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Half-width on wide screens; long answers take the full row. */
  wide?: boolean;
}

export interface ServicePackage {
  name: string;
  detail: string;
  price: string;
  unit: string;
}

/** Navigation categories; the offerings assigned to them come from the database. */
export type ServiceGroup = "occasions" | "business" | "travel";

export const SERVICE_GROUPS: Array<{ key: ServiceGroup; name: string; blurb: string }> = [
  {
    key: "occasions",
    name: "Occasions",
    blurb:
      "Explore transport for celebrations, events and special occasions.",
  },
  {
    key: "business",
    name: "Business travel",
    blurb:
      "Plan transport for work, meetings and company travel.",
  },
  {
    key: "travel",
    name: "Touring and outstation",
    blurb:
      "Find services for longer journeys and review the inclusions for your trip.",
  },
];

export interface Service {
  slug: string;
  name: string;
  /** Short label for nav and cards. */
  short: string;
  icon: string;
  kicker: string;
  title: string;
  blurb: string;
  /** The one-line promise, for cards and meta descriptions. */
  tagline: string;
  /** Which occasion prices it — the handling line and the fleet tag. */
  occasionSlug: string;
  /** Which band it sits under on the services index. */
  group: ServiceGroup;
  /** Pre-set filters for "see the cars for this", so the link lands usefully. */
  carFilter: { type?: string; seats?: string };
  h2: string;
  includes: Array<{ title: string; detail: string }>;
  packages: ServicePackage[];
  /** The honest caveat. Every service has one; hiding it costs a lead later. */
  note: string;
  fields: ServiceField[];
}


export function serviceFromPrice(service: Service): number | null {
  const prices = service.packages
      .map((item) => {
        const amount = item.price.trim().replace(/^(?:\u20b9|INR|Rs\.?)\s*/i, "").replace(/,/g, "");
        return /^\d+(?:\.\d{1,2})?$/.test(amount) ? Number(amount) : NaN;
      })
      .filter((value) => Number.isFinite(value) && value > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}
