import { useSyncExternalStore, type AnchorHTMLAttributes } from "react";

// The fixture has no Next server. Keep production shell/navigation components,
// adapting only the framework router boundary to browser history.
function navigate(href: string, replace = false) {
  window.history[replace ? "replaceState" : "pushState"](null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePathname() {
  return useSyncExternalStore((changed) => {
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
  }, () => window.location.pathname);
}

export function useRouter() {
  return { push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh: () => undefined };
}

export default function FixtureLink({ href = "", prefetch, onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) {
  void prefetch;
  return <a {...props} href={href} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || props.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !href.startsWith("/")) return;
    event.preventDefault();
    navigate(href);
  }}>{children}</a>;
}
