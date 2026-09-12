"use client";

import Script from "next/script";
import { useEffect } from "react";

import { GA_ID, META_PIXEL_ID, track } from "@/lib/analytics";

/**
 * The tags, and the one listener that makes them worth having (§25).
 *
 * Every WhatsApp link and every phone link on the site is caught here by
 * delegation rather than by wiring an onClick into each of the two dozen places
 * one appears. That is not laziness: a tracking call that has to be remembered
 * in every new component is a tracking call that will be missing from half of
 * them within a month, and the numbers would quietly under-report forever.
 */
export function Analytics() {
  useEffect(() => {
    if (!GA_ID && !META_PIXEL_ID) return;

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a");
      if (!link) return;

      const href = link.getAttribute("href") ?? "";
      if (href.includes("wa.me") || href.includes("api.whatsapp.com")) {
        track("whatsapp_click", { location: window.location.pathname });
      } else if (href.startsWith("tel:")) {
        track("call_click", { location: window.location.pathname });
      }
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments)}
window.gtag=gtag;
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}

      {META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
        </Script>
      )}
    </>
  );
}
