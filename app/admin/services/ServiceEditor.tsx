"use client";

import { useId, useState } from "react";
import { ReferenceSelect } from "@/components/admin/ReferenceSelect";
import { SERVICE_GROUPS, type Service, type ServiceField, type ServiceFieldType } from "@/lib/services";
import { AdminForm } from "../AdminForm";
import { saveService } from "./actions";

const emptyService: Service = { slug: "", name: "", short: "", icon: "ph-car", kicker: "", title: "", blurb: "", tagline: "", occasionSlug: "", group: "occasions", carFilter: {}, h2: "", includes: [], packages: [], note: "", fields: [] };

function TextControl({ label, value, onChange, multiline = false, required = false, max = 2000, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; required?: boolean; max?: number; disabled?: boolean;
}) {
  const id = useId();
  const props = { id, value, required, disabled, maxLength: max, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), className: "input" };
  return <div className="field"><label htmlFor={id}>{label}</label>{multiline ? <textarea {...props} rows={3} /> : <input {...props} />}</div>;
}

export function ServiceEditor({ initial, id, active = false, sort = 0, occasion, carType }: {
  initial?: Service; id?: string; active?: boolean; sort?: number; occasion?: { value: string; label: string }; carType?: { value: string; label: string };
}) {
  const [service, setService] = useState<Service>(initial ?? emptyService);
  const change = <K extends keyof Service>(key: K, value: Service[K]) => setService((current) => ({ ...current, [key]: value }));
  const changeField = (index: number, patch: Partial<ServiceField>) => change("fields", service.fields.map((field, position) => position === index ? { ...field, ...patch } : field));
  return (
    <AdminForm action={saveService} submitLabel={id ? "Save service" : "Create service"} className="max-w-5xl space-y-8">
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="definition" value={JSON.stringify(service)} />
      <fieldset className="space-y-4 rounded-xl border border-[var(--color-divider)] p-5">
        <legend className="px-2 text-lg font-medium">Publication and pricing</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextControl label="Service name" value={service.name} onChange={(value) => change("name", value)} required max={120} />
          <TextControl label="URL slug" value={service.slug} onChange={(value) => change("slug", value)} required max={80} disabled={Boolean(id)} />
          <TextControl label="Short name" value={service.short} onChange={(value) => change("short", value)} required max={60} />
          <div className="field"><label htmlFor="service-group">Group</label><select id="service-group" className="input" value={service.group} onChange={(event) => change("group", event.target.value as Service["group"])}>{SERVICE_GROUPS.map((group) => <option key={group.key} value={group.key}>{group.name}</option>)}</select></div>
          <ReferenceSelect kind="occasions" name="occasion_id" label="Pricing occasion" required initial={occasion ? [occasion] : []} hint="The handling charge and suitable vehicles come from this occasion." />
          <ReferenceSelect kind="car_types" name="car_type_id" label="Fleet type filter (optional)" initial={carType ? [carType] : []} hint="Leave empty to offer all types for this service." />
          <TextControl label="Minimum seats (optional)" value={service.carFilter.seats ?? ""} onChange={(seats) => change("carFilter", { ...service.carFilter, seats })} max={3} />
          <div className="field"><label htmlFor="service-sort">Display order</label><input id="service-sort" className="input" type="number" min={0} max={100000} name="sort" defaultValue={sort} required /></div>
        </div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="is_active" defaultChecked={active} /> Published on the website</label>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-[var(--color-divider)] p-5">
        <legend className="px-2 text-lg font-medium">Page content</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextControl label="Kicker" value={service.kicker} onChange={(value) => change("kicker", value)} required max={120} />
          <TextControl label="Icon name" value={service.icon} onChange={(value) => change("icon", value)} required max={80} />
        </div>
        <TextControl label="Page heading" value={service.title} onChange={(value) => change("title", value)} required max={200} />
        <TextControl label="Card tagline" value={service.tagline} onChange={(value) => change("tagline", value)} required max={200} />
        <TextControl label="Description" value={service.blurb} onChange={(value) => change("blurb", value)} required multiline />
        <TextControl label="Booking note" value={service.note} onChange={(value) => change("note", value)} multiline />
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-[var(--color-divider)] p-5">
        <legend className="px-2 text-lg font-medium">What is included</legend>
        <TextControl label="Includes heading" value={service.h2} onChange={(value) => change("h2", value)} required max={200} />
        {service.includes.map((item, index) => <div key={index} className="grid gap-3 border-t border-[var(--color-divider)] pt-4 sm:grid-cols-[1fr_2fr_auto]">
          <TextControl label={`Item ${index + 1} title`} value={item.title} onChange={(value) => change("includes", service.includes.map((row, position) => position === index ? { ...row, title: value } : row))} required max={120} />
          <TextControl label={`Item ${index + 1} detail`} value={item.detail} onChange={(value) => change("includes", service.includes.map((row, position) => position === index ? { ...row, detail: value } : row))} required max={600} />
          <button type="button" className="btn btn-secondary self-end" aria-label={`Remove included item ${index + 1}`} onClick={() => change("includes", service.includes.filter((_, position) => position !== index))}>Remove</button>
        </div>)}
        <button type="button" className="btn btn-secondary" disabled={service.includes.length >= 20} onClick={() => change("includes", [...service.includes, { title: "", detail: "" }])}>Add included item</button>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-[var(--color-divider)] p-5">
        <legend className="px-2 text-lg font-medium">Indicative packages</legend>
        <p className="text-sm text-[var(--color-neutral-400)]">These are advertised starting prices. Vehicle package rates remain under Fleet and Packages.</p>
        {service.packages.map((item, index) => <div key={index} className="space-y-3 border-t border-[var(--color-divider)] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">{([['name', 'Name'], ['detail', 'Description'], ['price', 'Price or On request'], ['unit', 'Unit']] as const).map(([key, label]) => <TextControl key={key} label={`Package ${index + 1}: ${label}`} value={item[key]} onChange={(value) => change("packages", service.packages.map((row, position) => position === index ? { ...row, [key]: value } : row))} required max={key === "detail" ? 600 : key === "price" ? 80 : 120} />)}</div>
          <button type="button" className="btn btn-secondary" aria-label={`Remove package ${index + 1}`} onClick={() => change("packages", service.packages.filter((_, position) => position !== index))}>Remove package</button>
        </div>)}
        <button type="button" className="btn btn-secondary" disabled={service.packages.length >= 20} onClick={() => change("packages", [...service.packages, { name: "", detail: "", price: "", unit: "" }])}>Add package</button>
      </fieldset>

      <fieldset className="space-y-5 rounded-xl border border-[var(--color-divider)] p-5">
        <legend className="px-2 text-lg font-medium">Enquiry questions</legend>
        <p className="text-sm text-[var(--color-neutral-400)]">Use Place search for locations. Car type choices stay in sync with the fleet.</p>
        {service.fields.map((field, index) => <div key={index} className="space-y-3 border-t border-[var(--color-divider)] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextControl label={`Question ${index + 1} label`} value={field.label} onChange={(label) => changeField(index, { label })} required max={120} />
            <TextControl label={`Question ${index + 1} key`} value={field.name} onChange={(name) => changeField(index, { name })} required max={60} />
            <div className="field"><label htmlFor={`question-type-${index}`}>Answer type</label><select id={`question-type-${index}`} className="input" value={field.type} onChange={(event) => changeField(index, { type: event.target.value as ServiceFieldType, optionsSource: undefined, options: undefined })}>{([['text', 'Short answer'], ['textarea', 'Long answer'], ['number', 'Number'], ['date', 'Date'], ['place', 'Place search'], ['select', 'Choices']] as const).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <TextControl label={`Question ${index + 1} hint`} value={field.hint ?? ""} onChange={(hint) => changeField(index, { hint })} max={300} />
          </div>
          {field.type === "select" && <>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={field.optionsSource === "carTypes"} onChange={(event) => changeField(index, { optionsSource: event.target.checked ? "carTypes" : undefined, options: undefined })} /> Use fleet car types</label>
            {field.optionsSource !== "carTypes" && <TextControl label={`Question ${index + 1} choices (one per line)`} multiline value={(field.options ?? []).join("\n")} onChange={(value) => changeField(index, { options: value.split("\n") })} max={4800} />}
          </>}
          {field.type === "number" && <div className="grid gap-3 sm:grid-cols-2">
            <TextControl label={`Question ${index + 1} minimum (optional)`} value={field.min === undefined ? "" : String(field.min)} onChange={(value) => changeField(index, { min: value === "" ? undefined : Number(value) })} max={12} />
            <TextControl label={`Question ${index + 1} maximum (optional)`} value={field.max === undefined ? "" : String(field.max)} onChange={(value) => changeField(index, { max: value === "" ? undefined : Number(value) })} max={12} />
          </div>}
          <div className="flex flex-wrap items-center gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(field.required)} onChange={(event) => changeField(index, { required: event.target.checked })} /> Required</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(field.wide)} onChange={(event) => changeField(index, { wide: event.target.checked })} /> Full width</label><button type="button" className="btn btn-secondary" aria-label={`Remove question ${index + 1}`} onClick={() => change("fields", service.fields.filter((_, position) => position !== index))}>Remove question</button></div>
        </div>)}
        <button type="button" className="btn btn-secondary" disabled={service.fields.length >= 24} onClick={() => change("fields", [...service.fields, { name: "", label: "", type: "text" }])}>Add question</button>
      </fieldset>
    </AdminForm>
  );
}
