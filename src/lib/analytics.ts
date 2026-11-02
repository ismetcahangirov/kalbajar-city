/** Events the site reports (GA4 names where GA4 has one). */
export type AnalyticsEvent = "generate_lead" | "click_call" | "click_whatsapp";

type WithDataLayer = { dataLayer?: unknown };

/**
 * Pushes an event to `window.dataLayer` when a tag manager has created it.
 * The site loads no analytics script itself; without one this does nothing.
 */
export function track(event: AnalyticsEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const layer = (window as WithDataLayer).dataLayer;
  if (Array.isArray(layer)) layer.push({ event, ...params });
}

export function isAnalyticsEvent(value: string | undefined): value is AnalyticsEvent {
  return value === "generate_lead" || value === "click_call" || value === "click_whatsapp";
}
