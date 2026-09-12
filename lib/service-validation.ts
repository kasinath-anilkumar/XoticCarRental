import type { Service, ServiceField, ServiceFieldType, ServiceGroup } from "./services";

const fieldTypes = new Set<ServiceFieldType>(["text", "number", "date", "select", "textarea", "place"]);
const groups = new Set<ServiceGroup>(["occasions", "business", "travel"]);
const reservedNames = new Set(["__proto__", "constructor", "prototype", "customerName", "customerPhone", "service", "returnDate"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, required = true): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(`${label} must be ${required ? "1–" : "at most "}${max} characters.`);
  return value.trim();
}

function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} must contain at most ${max} items.`);
  return value;
}

/** Validate at the admin boundary and again when consuming stored definitions. */
export function parseService(value: unknown): Service {
  const source = record(value, "Service");
  const slug = text(source.slug, "Slug", 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Use lowercase letters, numbers and single hyphens for the slug.");
  if (slug === "new") throw new Error("Choose another slug; new is reserved for the service editor.");
  const group = source.group as ServiceGroup;
  if (!groups.has(group)) throw new Error("Choose a valid service group.");
  const names = new Set<string>();
  const fields = list(source.fields, "Enquiry fields", 24).map((entry): ServiceField => {
    const field = record(entry, "Enquiry field");
    const name = text(field.name, "Field name", 60);
    if (!/^[a-z][a-zA-Z0-9]*$/.test(name) || reservedNames.has(name) || names.has(name)) throw new Error("Field names must be unique identifiers and cannot use reserved names.");
    names.add(name);
    const type = field.type as ServiceFieldType;
    if (!fieldTypes.has(type)) throw new Error("Choose a valid enquiry field type.");
    if (field.optionsSource !== undefined && (field.optionsSource !== "carTypes" || type !== "select")) throw new Error("Car type choices require a select field.");
    const options = field.options === undefined ? undefined : list(field.options, "Field choices", 40).map((option) => text(option, "Choice", 120));
    if (type === "select" && field.optionsSource !== "carTypes" && !options?.length) throw new Error("A select field needs choices or the fleet car types source.");
    if (options && new Set(options).size !== options.length) throw new Error("Field choices must be unique.");
    for (const limit of [field.min, field.max]) {
      if (limit !== undefined && (typeof limit !== "number" || !Number.isFinite(limit) || limit < 0 || limit > 1_000_000_000)) throw new Error("Numeric question bounds must be between zero and one billion.");
    }
    if (typeof field.min === "number" && typeof field.max === "number" && field.min > field.max) throw new Error("A question's minimum cannot exceed its maximum.");
    return { name, type, label: text(field.label, "Field label", 120),
      required: field.required === true, wide: field.wide === true,
      placeholder: text(field.placeholder, "Placeholder", 200, false),
      hint: text(field.hint, "Hint", 300, false),
      ...(typeof field.min === "number" ? { min: field.min } : {}),
      ...(typeof field.max === "number" ? { max: field.max } : {}),
      ...(field.optionsSource === "carTypes" ? { optionsSource: "carTypes" as const } : options ? { options } : {}),
    };
  });
  const carFilter = record(source.carFilter ?? {}, "Fleet filter");
  if (carFilter.seats && (typeof carFilter.seats !== "string" || !/^[1-9]\d?$/.test(carFilter.seats))) throw new Error("Minimum seats must be a whole number from 1 to 99.");
  return {
    slug, group, fields,
    name: text(source.name, "Name", 120), short: text(source.short, "Short name", 60),
    icon: text(source.icon, "Icon", 80), kicker: text(source.kicker, "Kicker", 120),
    title: text(source.title, "Title", 200), blurb: text(source.blurb, "Description", 2000),
    tagline: text(source.tagline, "Tagline", 200), occasionSlug: text(source.occasionSlug, "Pricing occasion", 80),
    h2: text(source.h2, "Includes heading", 200), note: text(source.note, "Booking note", 2000, false),
    carFilter: { ...(carFilter.type ? { type: text(carFilter.type, "Fleet type", 120) } : {}),
      ...(carFilter.seats ? { seats: text(carFilter.seats, "Seat filter", 4) } : {}) },
    includes: list(source.includes, "Included items", 20).map((entry) => {
      const item = record(entry, "Included item");
      return { title: text(item.title, "Included title", 120), detail: text(item.detail, "Included detail", 600) };
    }),
    packages: list(source.packages, "Indicative packages", 20).map((entry) => {
      const item = record(entry, "Package");
      return { name: text(item.name, "Package name", 120), detail: text(item.detail, "Package detail", 600),
        price: text(item.price, "Package price", 80), unit: text(item.unit, "Package unit", 120) };
    }),
  };
}

export function resolveServiceChoices(service: Service, carTypes: readonly string[]): Service {
  return { ...service, fields: service.fields.map((field) => field.optionsSource === "carTypes"
    ? { ...field, options: [...new Set(carTypes)].sort((a, b) => a.localeCompare(b)) }
    : field) };
}
