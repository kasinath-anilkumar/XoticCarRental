import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStopPopup } from "./stop-popup";

/** The popup needs only text assignment and node insertion. Deliberately fail
 * if its implementation ever starts parsing a customer label as HTML. */
class TextElement {
  readonly children: TextElement[] = [];
  textContent = "";

  constructor(readonly tagName: string) {}
  append(...nodes: TextElement[]) { this.children.push(...nodes); }
  get firstElementChild() { return this.children[0]; }
  get lastElementChild() { return this.children.at(-1); }
  set innerHTML(_value: string) { throw new Error("Popup content must never use an HTML sink"); }
  insertAdjacentHTML() { throw new Error("Popup content must never use an HTML sink"); }
}

const created: TextElement[] = [];

beforeEach(() => {
  created.length = 0;
  vi.stubGlobal("document", {
    createElement(tag: string) {
      const element = new TextElement(tag.toUpperCase());
      created.push(element);
      return element;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("route stop popups", () => {
  it.each([
    { names: ["Airport"], roles: ["Pickup"] },
    { names: ["Airport", "Hotel"], roles: ["Pickup", "Drop"] },
    { names: ["Home", "Venue", "Home"], roles: ["Pickup", "Stop 1", "Drop"] },
    { names: ["Home", "Temple", "Venue", "Hotel", "Home"], roles: ["Pickup", "Stop 1", "Stop 2", "Stop 3", "Drop"] },
  ])("labels the complete itinerary $names", ({ names, roles }) => {
    const popups = names.map((name, index) => createStopPopup(name, index, names.length));
    expect(popups.map((popup) => popup.firstElementChild?.textContent)).toEqual(roles);
    expect(popups.map((popup) => popup.lastElementChild?.textContent)).toEqual(names);
  });

  it.each([
    '<img src=x onerror="alert(document.domain)">',
    '</span><script>alert(1)</script><span>',
    'Airport & Hotel <North> "Gate 4"',
  ])("preserves a label literally without parsing markup: %s", (name) => {
    const popup = createStopPopup(name, 1, 3);
    expect(typeof popup).toBe("object");
    expect(popup.firstElementChild?.textContent).toBe("Stop 1");
    expect(popup.lastElementChild?.textContent).toBe(name);
    expect(created.some((element) => ["IMG", "SCRIPT", "IFRAME", "SVG"].includes(element.tagName))).toBe(false);
  });
});
