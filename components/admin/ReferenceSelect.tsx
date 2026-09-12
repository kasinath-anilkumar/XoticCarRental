"use client";

import { useCombobox } from "downshift";
import { useEffect, useId, useState } from "react";
import type { ReferenceKind, ReferenceOption, ReferencePage } from "@/lib/admin/references";

interface Props {
  kind: ReferenceKind; name: string; label: string;
  initial?: ReferenceOption[]; multiple?: boolean; required?: boolean;
  cityId?: string; hint?: string; onChange?: (value: string) => void;
}

/** Loads only an opened picker's current search page; selected IDs survive paging. */
export function ReferenceSelect({ kind, name, label, initial = [], multiple = false, required = false, cityId, hint, onChange }: Props) {
  const id = useId();
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState(multiple ? "" : initial[0]?.label ?? "");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ReferencePage>({ options: [], page: 1, hasMore: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const options = result.options.filter((item) => !multiple || !selected.some((entry) => entry.value === item.value));
  const combo = useCombobox({
    id,
    items: options,
    selectedItem: multiple ? null : selected[0] ?? null,
    inputValue: query,
    itemToString: (item) => item?.label ?? "",
    onInputValueChange({ inputValue, type }) {
      if (type === useCombobox.stateChangeTypes.InputChange) {
        setQuery(inputValue);
        setPage(1);
        setResult({ options: [], page: 1, hasMore: false });
        if (!multiple) { setSelected([]); onChange?.(""); }
      }
    },
    onSelectedItemChange({ selectedItem }) {
      if (!selectedItem) return;
      setSelected((current) => multiple ? [...current.filter((item) => item.value !== selectedItem.value), selectedItem] : [selectedItem]);
      setQuery(multiple ? "" : selectedItem.label);
      setPage(1);
      onChange?.(selectedItem.value);
    },
  });
  const search = !multiple && query === selected[0]?.label ? "" : query.trim();
  useEffect(() => {
    if (!combo.isOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ kind, q: search, page: String(page) });
        if (cityId) params.set("city", cityId);
        const response = await fetch(`/api/admin/options?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load choices.");
        if (!controller.signal.aborted) setResult(data);
      } catch (cause) {
        if (!controller.signal.aborted) { setResult({ options: [], page, hasMore: false }); setError(cause instanceof Error ? cause.message : "Could not load choices."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [combo.isOpen, kind, search, page, cityId]);

  return <div className="field relative min-w-0">
    <label {...combo.getLabelProps()}>{label}</label>
    {selected.map((item) => <input key={item.value} type="hidden" name={name} value={item.value} />)}
    {!multiple && selected.length === 0 && <input type="hidden" name={name} value="" />}
    {multiple && selected.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{selected.map((item) => <button key={item.value} type="button" className="btn btn-ghost" aria-label={`Remove ${item.label}`} onClick={() => setSelected((current) => current.filter((entry) => entry.value !== item.value))}>{item.label} ×</button>)}</div>}
    <div className="flex gap-2">
      <input {...combo.getInputProps({ className: "input min-w-0", placeholder: "Search saved records…", maxLength: 100, required: required && selected.length === 0, pattern: required && selected.length === 0 ? "(?!)" : undefined, title: "Choose a saved record from the results.", onBlur: () => { if (!multiple) setQuery(selected[0]?.label ?? ""); } })} />
      {selected.length > 0 && !multiple && <button type="button" className="btn btn-ghost" aria-label={`Clear ${label}`} onClick={() => { setSelected([]); setQuery(""); onChange?.(""); }}>×</button>}
    </div>
    <div className={combo.isOpen ? "absolute top-full right-0 left-0 z-40 rounded-md border border-[var(--color-divider)] bg-surface shadow-xl" : "hidden"}>
      <ul {...combo.getMenuProps()} className="m-0 max-h-64 list-none overflow-y-auto p-1">
        {combo.isOpen && options.map((item, index) => <li key={item.value} {...combo.getItemProps({ item, index })} className={`cursor-pointer rounded p-3 text-sm ${combo.highlightedIndex === index ? "bg-[var(--color-accent-900)]" : ""}`}>{item.label}{item.detail && <span className="block text-xs text-[var(--color-neutral-400)]">{item.detail}</span>}</li>)}
      </ul>
      <output className="m-0 block px-3 py-2 text-xs">{loading ? "Loading choices…" : error || (options.length === 0 ? "No matching records. Add the record in its management page." : `Page ${result.page}`)}</output>
      {(page > 1 || result.hasMore) && <div className="flex justify-between gap-2 p-2">
        <button type="button" className="btn btn-ghost" disabled={loading || page <= 1} onMouseDown={(event) => event.preventDefault()} onClick={() => { setPage((value) => value - 1); setResult({ options: [], page, hasMore: false }); }}>Previous choices</button>
        <button type="button" className="btn btn-ghost" disabled={loading || !result.hasMore} onMouseDown={(event) => event.preventDefault()} onClick={() => { setPage((value) => value + 1); setResult({ options: [], page, hasMore: false }); }}>Next choices</button>
      </div>}
    </div>
    {hint && <p className="mt-1 text-xs text-[var(--color-neutral-400)]">{hint}</p>}
  </div>;
}
