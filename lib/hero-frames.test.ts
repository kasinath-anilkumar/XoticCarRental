import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("node:fs/promises", () => ({ readdir: vi.fn() }));

import { readdir } from "node:fs/promises";
import { getHeroFrames } from "./hero-frames";

const readDirectory = vi.mocked(readdir);

describe("hero frame discovery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("orders numbered frames naturally, encodes filenames and ignores unsupported files and directories", async () => {
    const entries = [
      ["frame-10.JPG", true], ["frame-2.jpeg", true], ["frame-1.png", true],
      ["frame-11 #end.webp", true], ["notes.txt", true], ["nested.jpg", false],
    ].map(([name, file]) => ({ name, isFile: () => file }));
    readDirectory.mockResolvedValue(entries as never);
    expect(await getHeroFrames()).toEqual([
      "/exoticbanner/frame-1.png", "/exoticbanner/frame-2.jpeg",
      "/exoticbanner/frame-10.JPG", "/exoticbanner/frame-11%20%23end.webp",
    ]);
  });

  it("allows the page to use its fallback hero when the directory is missing", async () => {
    readDirectory.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    expect(await getHeroFrames()).toEqual([]);
  });

  it("surfaces read failures instead of silently hiding a deployment problem", async () => {
    readDirectory.mockRejectedValue(Object.assign(new Error("denied"), { code: "EACCES" }));
    await expect(getHeroFrames()).rejects.toThrow("denied");
  });
});
