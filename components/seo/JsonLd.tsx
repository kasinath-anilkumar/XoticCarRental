import { rateFor } from "@/lib/pricing";
import { siteUrl } from "@/lib/site";
import type { Car, City, Package, SiteSettings } from "@/lib/types";

/**
 * Structured data.
 *
 * Rendered as a script tag rather than through next/script so it is present in
 * the static HTML a crawler reads. The values come from the same catalog the
 * page renders, so the markup can never drift from what a visitor sees — which
 * is what search engines check for.
 */
function JsonLdScript({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // The payload is our own catalog data, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function LocalBusinessJsonLd({
  settings,
  cities,
}: {
  settings: SiteSettings;
  cities: City[];
}) {
  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@type": "AutoRental",
        name: "Xotic Car Rental",
        description:
          "Chauffeur-driven luxury car rental across Kerala, Karnataka and Tamil Nadu — weddings, shoots, corporate travel, VIP transfers and tours.",
        url: siteUrl(),
        telephone: settings.phoneDisplay,
        email: settings.email,
        priceRange: "₹₹₹",
        areaServed: cities.map((city) => ({
          "@type": "City",
          name: city.name,
          address: { "@type": "PostalAddress", addressRegion: city.state, addressCountry: "IN" },
        })),
      }}
    />
  );
}

export function CarJsonLd({
  car,
  city,
  pkg,
  images,
}: {
  car: Car;
  city: City;
  pkg: Package;
  images: string[];
}) {
  const price = Math.round(rateFor(car, pkg.rateKey) * city.multiplier);

  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: `${car.name} with driver`,
        description: `${car.year} ${car.name} — ${car.type}, ${car.seats} seats, ${car.transmission}, ${car.fuel}. Chauffeur-driven in ${city.name}.`,
        ...(images.length > 0 ? { image: images } : {}),
        brand: { "@type": "Brand", name: car.name.split(" ")[0] },
        // No aggregateRating: there is no review platform behind Car.rating, so
        // emitting one would be asserting a rating nobody gave. Product/Offer
        // is kept because the price it declares is the price we charge.
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price,
          availability: "https://schema.org/InStock",
          url: `${siteUrl()}/cars/${car.slug}`,
          areaServed: { "@type": "City", name: city.name },
          description: `${pkg.label} package`,
        },
      }}
    />
  );
}

export function FaqJsonLd({ items }: { items: Array<{ q: string; a: string }> }) {
  if (items.length === 0) return null;
  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }}
    />
  );
}

export function BreadcrumbJsonLd({ trail }: { trail: Array<{ name: string; path: string }> }) {
  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: trail.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: `${siteUrl()}${crumb.path}`,
        })),
      }}
    />
  );
}
