import { connection } from "next/server";
import Script from "next/script";

import { getAnalyticsIds } from "@/lib/public/site";

/** The GA4 bootstrap: `gtag()` queues on `dataLayer` until gtag.js has loaded. */
export function gtagInit(id: string): string {
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    "gtag('js',new Date());",
    `gtag('config',${JSON.stringify(id)});`,
  ].join("");
}

/** Meta's standard Pixel bootstrap, which loads fbevents.js itself. */
export function pixelInit(id: string): string {
  return [
    "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?",
    "n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;",
    "n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;",
    "t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}",
    "(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');",
    `fbq('init',${JSON.stringify(id)});fbq('track','PageView');`,
  ].join("");
}

/**
 * GA4 and the Meta Pixel, with the IDs from the console's settings (#29).
 * Nothing is rendered until an ID is saved. `lazyOnload` injects the scripts
 * when the browser is idle after the page has loaded, so they never compete
 * with the LCP image or the hydration bundle. Both report client-side
 * navigations themselves (GA4's enhanced measurement, the Pixel's history
 * tracking). Events go through `track()` in `@/lib/analytics`.
 */
export async function AnalyticsScripts() {
  await connection();
  const { googleAnalyticsId, metaPixelId } = await getAnalyticsIds();
  return (
    <>
      {googleAnalyticsId && (
        <>
          <Script id="ga4-init" strategy="lazyOnload">
            {gtagInit(googleAnalyticsId)}
          </Script>
          <Script
            id="ga4"
            strategy="lazyOnload"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAnalyticsId)}`}
          />
        </>
      )}
      {metaPixelId && (
        <Script id="meta-pixel" strategy="lazyOnload">
          {pixelInit(metaPixelId)}
        </Script>
      )}
    </>
  );
}
