/** Events the site reports (GA4 names where GA4 has one). */
export type AnalyticsEvent = "generate_lead" | "click_call" | "click_whatsapp";

/** The Meta Pixel's standard event for each of ours. */
const pixelEvents: Record<AnalyticsEvent, string> = {
  generate_lead: "Lead",
  click_call: "Contact",
  click_whatsapp: "Contact",
};

type Tracker = (...args: unknown[]) => void;
type WithTrackers = { dataLayer?: unknown; gtag?: unknown; fbq?: unknown };

/**
 * Reports an event to GA4 and the Meta Pixel when the console has set them up
 * (`AnalyticsScripts`). Until their scripts have loaded, their bootstraps
 * queue the call; without them it goes to `window.dataLayer` if a tag manager
 * created one, and otherwise does nothing.
 */
export function track(event: AnalyticsEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const w = window as WithTrackers;
  if (typeof w.gtag === "function") (w.gtag as Tracker)("event", event, params);
  else if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event, ...params });
  if (typeof w.fbq === "function") (w.fbq as Tracker)("track", pixelEvents[event]);
}

export function isAnalyticsEvent(value: string | undefined): value is AnalyticsEvent {
  return value === "generate_lead" || value === "click_call" || value === "click_whatsapp";
}
