import { utmKeys } from "@/shared/lead-fields";

/** Where a visitor came from, as the lead forms send it. Browser only. */
export type Attribution = {
  utm?: Partial<Record<(typeof utmKeys)[number], string>>;
  referrer?: string;
};

const storageKey = "kc-attribution";

function stored(): Attribution {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
    return value && typeof value === "object" ? (value as Attribution) : {};
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    return {};
  }
}

function store(value: Attribution) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Without storage, attribution lasts as long as the URL keeps it.
  }
}

/**
 * Reads `utm_*` from the URL and a cross-origin `document.referrer`, and keeps
 * them for the session, so a lead sent pages later is still attributed to the
 * visit's campaign. A new campaign in the URL replaces the stored one.
 */
export function captureAttribution(): Attribution {
  const current = stored();
  const params = new URLSearchParams(window.location.search);
  const utm = Object.fromEntries(
    utmKeys
      .map((key) => [key, params.get(`utm_${key}`)?.trim().slice(0, 200)] as const)
      .filter((entry): entry is readonly [(typeof utmKeys)[number], string] => !!entry[1]),
  );

  let referrer: string | undefined;
  try {
    const url = new URL(document.referrer);
    if (url.origin !== window.location.origin) referrer = url.href.slice(0, 1000);
  } catch {
    // No referrer, or not a URL.
  }

  const next: Attribution = {
    utm: Object.keys(utm).length ? utm : current.utm,
    referrer: referrer ?? current.referrer,
  };
  if (next.utm !== current.utm || next.referrer !== current.referrer) store(next);
  return next;
}
