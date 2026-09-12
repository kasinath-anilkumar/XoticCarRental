interface ServiceCity {
  slug: string;
  name: string;
  state: string;
  airportName?: string | null;
}

/** State options come only from the service cities supplied by the catalog. */
export function serviceStates(cities: ReadonlyArray<Pick<ServiceCity, "state">>): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const city of cities) {
    const name = city.state.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Text search narrows the selected state instead of silently ignoring it. */
export function filterServiceCities<T extends ServiceCity>(cities: readonly T[], state: string, query: string): T[] {
  const search = query.trim().toLocaleLowerCase();
  return cities.filter((city) =>
    (state === "all" || city.state.trim() === state) &&
    (!search || [city.name, city.state, city.slug, city.airportName ?? ""].some((value) => value.toLocaleLowerCase().includes(search))),
  );
}
