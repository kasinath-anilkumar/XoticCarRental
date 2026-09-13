import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VehicleGallery } from "./VehicleGallery";

describe("vehicle gallery presentation", () => {
  it("starts with the published hero and exposes each distinct uploaded angle once", () => {
    const html = renderToStaticMarkup(<VehicleGallery name="Test car" images={[
      { url: "/test/interior.jpg", kind: "interior", alt: "The actual cabin" },
      { url: "/test/hero.jpg", kind: "hero", alt: "The actual exterior" },
      { url: "/test/hero.jpg", kind: "detail", alt: "Duplicate image" },
    ]} />);
    expect(html.indexOf('alt="The actual exterior"')).toBeGreaterThan(-1);
    expect(html).toContain("01 / 02");
    expect(html).toContain('aria-label="Show Test car hero photo"');
    expect(html).toContain('aria-label="Show Test car interior photo"');
    expect(html).not.toContain('aria-label="Show Test car detail photo"');
  });

  it("does not invent photo controls for an empty gallery", () => {
    const html = renderToStaticMarkup(<VehicleGallery name="Test car" images={[]} />);
    expect(html).toContain('aria-label="Vehicle gallery"');
    expect(html).not.toContain("Show Test car");
    expect(html).not.toContain("<img");
  });
});
