"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { NavigationFocus } from "./NavigationFocus";

/** Server-rendered page slots keep their data on the server; admin owns its navigation. */
export function SiteChrome({ children, header, footer, actions }: {
  children: ReactNode; header: ReactNode; footer: ReactNode; actions: ReactNode;
}) {
  const pathname = usePathname();
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  return <>
    {!admin && <Suspense fallback={null}><NavigationFocus /></Suspense>}
    {!admin && header}
    <main id="main" tabIndex={-1} data-workspace={admin ? "admin" : undefined}>{children}</main>
    {!admin && <>{footer}{actions}</>}
  </>;
}
