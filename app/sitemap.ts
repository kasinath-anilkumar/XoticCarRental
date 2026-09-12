import type { MetadataRoute } from "next";

import { getCatalog } from "@/lib/content";
import { getServices } from "@/lib/service-content";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, services] = await Promise.all([getCatalog(), getServices()]);
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/cars`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/services`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/cities`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/price-calculator`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/gallery`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/packages`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.6 },
  ];

  // The booking summary is a personal, transient page — excluded here and
  // noindexed in its own metadata.
  return [
    ...staticRoutes,
    ...catalog.cars.map((car) => ({
      url: `${base}/cars/${car.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...services.map((service) => ({
      url: `${base}/services/${service.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // Service × city (§24): "wedding car rental in Kochi" is a different
    // search from either half of it, and these are the pages that answer it.
    ...services.flatMap((service) =>
      catalog.cities.map((city) => ({
        url: `${base}/services/${service.slug}/${city.slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ),
    ...catalog.cities.map((city) => ({
      url: `${base}/cities/${city.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
  ];
}
