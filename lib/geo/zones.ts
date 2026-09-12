export type IndiaZone = "all" | "north" | "south" | "west" | "east_central";

export interface ZoneConfig {
  key: IndiaZone;
  label: string;
  shortLabel: string;
  description: string;
}

export const ZONES: ZoneConfig[] = [
  { key: "all", label: "All India", shortLabel: "All", description: "Pan-India operational network" },
  { key: "north", label: "North India", shortLabel: "North", description: "Delhi NCR, Rajasthan, Punjab, UP & Hills" },
  { key: "west", label: "West India", shortLabel: "West", description: "Maharashtra, Goa & Gujarat" },
  { key: "south", label: "South India", shortLabel: "South", description: "Karnataka, Kerala, Tamil Nadu & Telangana" },
  { key: "east_central", label: "East & Central", shortLabel: "East & Central", description: "West Bengal, Odisha, MP & North-East" },
];

export const STATE_TO_ZONE: Record<string, IndiaZone> = {
  // North India
  "Delhi": "north",
  "Delhi NCR": "north",
  "Rajasthan": "north",
  "Punjab": "north",
  "Haryana": "north",
  "Uttar Pradesh": "north",
  "Uttarakhand": "north",
  "Himachal Pradesh": "north",
  "Jammu & Kashmir": "north",
  "Ladakh": "north",
  "Chandigarh": "north",

  // West India
  "Maharashtra": "west",
  "Goa": "west",
  "Gujarat": "west",
  "Dadra and Nagar Haveli and Daman and Diu": "west",

  // South India
  "Kerala": "south",
  "Karnataka": "south",
  "Tamil Nadu": "south",
  "Telangana": "south",
  "Andhra Pradesh": "south",
  "Puducherry": "south",
  "Lakshadweep": "south",

  // East & Central India
  "West Bengal": "east_central",
  "Odisha": "east_central",
  "Madhya Pradesh": "east_central",
  "Bihar": "east_central",
  "Jharkhand": "east_central",
  "Chhattisgarh": "east_central",
  "Assam": "east_central",
  "Sikkim": "east_central",
  "Meghalaya": "east_central",
  "Arunachal Pradesh": "east_central",
  "Nagaland": "east_central",
  "Manipur": "east_central",
  "Mizoram": "east_central",
  "Tripura": "east_central",
  "Andaman and Nicobar Islands": "east_central",
};

/** Returns the zone key for a given state name. */
export function zoneForState(state: string): IndiaZone {
  return STATE_TO_ZONE[state] ?? "all";
}

/** Filters a list of items having a `state` property by zone. */
export function filterByZone<T extends { state: string }>(items: T[], zone: IndiaZone): T[] {
  if (zone === "all") return items;
  return items.filter((item) => zoneForState(item.state) === zone);
}

