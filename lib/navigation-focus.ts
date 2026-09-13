let latestFocusRequest = 0;

/** Reveal optional content before focusing an explicit navigation/validation target. */
export function focusPageTarget(id: string): boolean {
  // A streamed ID can exist inside Next's hidden staging container before it
  // mounts in main. Reporting that copy as found stops NavigationFocus's
  // observer before the actual destination becomes focusable.
  const selector = `#${CSS.escape(id)}`;
  const mounted = (element: HTMLElement) => !element.closest("[hidden], [inert]");
  const target = Array.from(document.querySelectorAll<HTMLElement>(`#main ${selector}`)).find(mounted)
    ?? Array.from(document.querySelectorAll<HTMLElement>(selector)).find(mounted);
  if (!target) return false;
  const request = ++latestFocusRequest;
  const activeAtRequest = document.activeElement;
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement) node.open = true;
  }
  target.dispatchEvent(new Event("xotic:reveal-target", { bubbles: true }));
  // Disclosure state must commit before measuring a previously hidden target.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!target.isConnected || !mounted(target) || request !== latestFocusRequest) return;
    // Do not take focus back if the customer has already started using a field.
    const active = document.activeElement;
    if (active !== activeAtRequest && active !== target && active instanceof HTMLElement && active.matches("a[href], button, input, select, textarea, [contenteditable=true]")) return;
    if (!target.matches("a[href], button, input, select, textarea, [tabindex]")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: "instant" });
  }));
  return true;
}
