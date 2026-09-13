"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { GeoKind } from "@/lib/geo/types";
import { styles } from "@/app/admin/styles";

interface Place { name: string; state: string; detail: string; lat: number; lng: number; kind: GeoKind }
interface Props { name?: string; state?: string; lat?: number; lng?: number; includeState?: boolean; cityOnly?: boolean }

/** Geocoding proposes coordinates; staff explicitly select the saved service city. */
export function GeoRecordFields({ name: initialName = "", state: initialState = "", lat: initialLat, lng: initialLng, includeState = false, cityOnly = false }: Props) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [state, setState] = useState(initialState);
  const [lat, setLat] = useState(initialLat === undefined ? "" : String(initialLat));
  const [lng, setLng] = useState(initialLng === undefined ? "" : String(initialLng));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); setBusy(false); return; }
      active.current?.abort();
      active.current = controller;
      setBusy(true);
      setNote("");
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (cityOnly) params.set("kind", "city");
        const response = await fetch(`/api/admin/geocode?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Place lookup failed.");
        if (!controller.signal.aborted) { setResults(data.results ?? []); setNote(data.error ?? ""); }
      } catch (error) {
        if (!controller.signal.aborted) setNote(error instanceof Error ? error.message : "Place lookup failed. Enter coordinates manually.");
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, cityOnly]);

  function choose(place: Place) {
    setName(place.name);
    setState(place.state);
    setLat(String(place.lat));
    setLng(String(place.lng));
    setQuery("");
    setResults([]);
    setNote(`Selected ${place.name}${place.detail ? ` — ${place.detail}` : ""}. Review the name and coordinates before saving.`);
  }

  function locate() {
    if (!navigator.geolocation) { setNote("This browser cannot share its location. Search or enter coordinates."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (!mounted.current) return;
      setLat(coords.latitude.toFixed(5));
      setLng(coords.longitude.toFixed(5));
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      try {
        const params = new URLSearchParams({ lat: String(coords.latitude), lng: String(coords.longitude) });
        const response = await fetch(`/api/admin/geocode?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Address lookup failed.");
        if (!controller.signal.aborted) {
          const place = data.results?.[0] as Place | undefined;
          if (place) { if (!name) setName(place.name); if (place.state) setState(place.state); }
          setNote("Coordinates captured. Review the record name and service city before saving.");
        }
      } catch { if (!controller.signal.aborted) setNote("Coordinates captured. Enter the record name and state manually."); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, (error) => { if (mounted.current) { setBusy(false); setNote(error.code === 1 ? "Location permission was declined. Search or enter coordinates." : "Could not locate this device. Search or enter coordinates."); } }, { timeout: 10_000, maximumAge: 60_000 });
  }

  return <div className={styles.geoPanel}>
    <div className={styles.geoSearch}>
      <div className="field min-w-0"><label htmlFor={`${id}-search`}>{cityOnly ? "Find a city on the map" : "Find a place on the map"}</label><input id={`${id}-search`} className="input" maxLength={200} value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); }} placeholder="Search by place name or address" /></div>
      <button type="button" className="btn btn-secondary" onClick={locate} disabled={busy}>Use current coordinates</button>
    </div>
    {results.length > 0 && <ul className="scroll-shadows mb-3 max-h-60 list-none overflow-y-auto p-0">{results.map((place) => <li key={`${place.lat}:${place.lng}:${place.name}`}><button type="button" className="w-full rounded p-3 text-left text-sm hover:bg-[var(--color-accent-900)]" onClick={() => choose(place)}><strong>{place.name}</strong><span className="block text-xs">{place.detail || place.state} · {place.lat}, {place.lng}</span></button></li>)}</ul>}
    <output className="mb-3 block text-xs text-[var(--color-neutral-400)]">{busy ? "Looking up coordinates…" : note}</output>
    <div className={styles.grid4}>
      <div className="field"><label htmlFor={`${id}-name`}>Name</label><input id={`${id}-name`} name="name" className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} /></div>
      {includeState && <div className="field"><label htmlFor={`${id}-state`}>State or region</label><input id={`${id}-state`} name="state" className="input" value={state} onChange={(event) => setState(event.target.value)} required maxLength={100} /></div>}
      <div className="field"><label htmlFor={`${id}-lat`}>Latitude</label><input id={`${id}-lat`} name="lat" className="input" type="number" step="any" min={-90} max={90} value={lat} onChange={(event) => setLat(event.target.value)} required /></div>
      <div className="field"><label htmlFor={`${id}-lng`}>Longitude</label><input id={`${id}-lng`} name="lng" className="input" type="number" step="any" min={-180} max={180} value={lng} onChange={(event) => setLng(event.target.value)} required /></div>
    </div>
  </div>;
}
