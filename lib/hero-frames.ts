import "server-only";

import { readdir } from "node:fs/promises";
import { join } from "node:path";

const frameOrder = new Intl.Collator("en", { numeric: true, sensitivity: "variant" });
const supportedImage = /\.(?:jpe?g|png|webp)$/i;

/** The first numerically ordered frame is also the static hero poster. */
export async function getHeroFrames(): Promise<string[]> {
  try {
    const entries = await readdir(join(process.cwd(), "public", "exoticbanner"), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && supportedImage.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => frameOrder.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0))
      .map((name) => `/exoticbanner/${encodeURIComponent(name)}`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
