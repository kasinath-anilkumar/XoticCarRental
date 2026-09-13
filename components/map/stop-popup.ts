/** The map receives the complete passenger itinerary, including its final drop. */
export function createStopPopup(name: string, index: number, total: number): HTMLElement {
  const popup = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = index === 0 ? "Pickup" : index === total - 1 ? "Drop" : `Stop ${index}`;
  const place = document.createElement("span");
  // Place names can come from a customer URL or a geocoder. Leaflet parses
  // string popups as HTML, so pass nodes and keep the entire label as text.
  place.textContent = name;
  popup.append(heading, document.createElement("br"), place);
  return popup;
}
