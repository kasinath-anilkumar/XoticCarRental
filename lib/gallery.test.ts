import { describe, expect, it } from "vitest";
import { galleryFromCars } from "./gallery";
import type { Car } from "./types";

describe("published vehicle gallery", () => {
  it("uses configured images and vehicle types without inventing files or duplicate frames", () => {
    const cars = [
      { slug: "one", name: "Car one", type: "Custom type", images: [{ url: "https://images.example/one.jpg", kind: "hero", alt: "Uploaded caption" }, { url: "", kind: "rear", alt: null }] },
      { slug: "two", name: "Car two", type: "Custom type", images: [{ url: "https://images.example/one.jpg", kind: "hero", alt: null }, { url: "/media/cars/two/interior.png", kind: "interior", alt: null }] },
      { slug: "three", name: "Car three", type: "No photos", images: [] },
    ] as Car[];
    const categories = galleryFromCars(cars);
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe("Custom type");
    expect(categories[0].browseHref).toBe("/cars?type=Custom%20type");
    expect(categories[0].frames).toHaveLength(2);
    expect(categories[0].frames[0].alt).toBe("Uploaded caption");
    expect(categories[0].frames[1].carHref).toBe("/cars/two");
    expect(categories[0].frames[1].alt).toBe("Car two — interior");
  });

  it("returns an empty gallery for an empty catalog", () => {
    expect(galleryFromCars([])).toEqual([]);
  });
});
