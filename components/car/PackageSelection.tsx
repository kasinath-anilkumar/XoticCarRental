"use client";

import { createContext, Suspense, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { Package } from "@/lib/types";

/**
 * Which package the car detail page is showing.
 *
 * This used to live in a `?pkg=` search param. Reading searchParams opts the
 * whole route out of static rendering, and car pages are the ones worth
 * prerendering — so the selection is client state instead. It also makes the
 * chooser instant, with no navigation per click.
 */
interface PackageSelectionValue {
  packages: Package[];
  selected: Package;
  select: (slug: string) => void;
}

const PackageSelectionContext = createContext<PackageSelectionValue | null>(null);

export function PackageSelectionProvider({
  packages,
  children,
}: {
  packages: Package[];
  children: React.ReactNode;
}) {
  const [slug, setSlug] = useState(packages[0]?.slug ?? "");

  const value = useMemo<PackageSelectionValue>(
    () => ({
      packages,
      selected: packages.find((pkg) => pkg.slug === slug) ?? packages[0],
      select: setSlug,
    }),
    [packages, slug],
  );

  return (
    <PackageSelectionContext.Provider value={value}>
      <Suspense fallback={null}><PackageFromQuery packages={packages} onSelect={setSlug} /></Suspense>
      {children}
    </PackageSelectionContext.Provider>
  );
}

function PackageFromQuery({ packages, onSelect }: { packages: Package[]; onSelect: (slug: string) => void }) {
  const query = useSearchParams();
  const slug = query.get("pkg");
  useEffect(() => {
    if (slug && packages.some((pkg) => pkg.slug === slug)) onSelect(slug);
  }, [slug, packages, onSelect]);
  return null;
}

export function usePackageSelection(): PackageSelectionValue {
  const value = useContext(PackageSelectionContext);
  if (!value) {
    throw new Error("usePackageSelection must be used inside a PackageSelectionProvider.");
  }
  return value;
}
