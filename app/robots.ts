import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Quotes carry a specific customer's trip; the admin panel is private.
        disallow: ["/booking-summary", "/admin", "/api/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
