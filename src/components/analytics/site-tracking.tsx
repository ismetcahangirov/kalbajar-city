"use client";

import { useEffect } from "react";

import { isAnalyticsEvent, track } from "@/lib/analytics";
import { captureAttribution } from "@/lib/leads/attribution";

/**
 * Renders nothing. On the landing page it keeps the visit's UTM parameters
 * and referrer for the lead forms, and it reports clicks on any link marked
 * `data-track="click_call"` or `"click_whatsapp"` (the shell's call and
 * WhatsApp CTAs), so those stay server components.
 */
export function SiteTracking() {
  useEffect(() => {
    captureAttribution();
    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLElement>("[data-track]");
      const name = link?.dataset.track;
      if (link && isAnalyticsEvent(name)) {
        track(name, { link_url: link.getAttribute("href") ?? undefined });
      }
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
