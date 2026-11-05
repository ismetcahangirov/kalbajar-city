/**
 * What client components read from the catalogue. `NextIntlClientProvider`
 * serialises what it is given into the page's HTML, and server components read
 * the catalogue on the server, so everything else stays out of the page (#30:
 * the whole catalogue was 22 KB of every page's inline payload).
 * tests/unit/i18n-client-messages.test.ts fails when a client component reads
 * something that is not sent.
 */

/** What the shell reads, on every page: `Namespace` or `Namespace.key`. */
export const shellMessages = [
  "ErrorPage",
  "LeadForm.apartment",
  "LeadForm.consent",
  "LeadForm.consentLabel",
  "LeadForm.email",
  "LeadForm.error",
  "LeadForm.honeypot",
  "LeadForm.message",
  "LeadForm.name",
  "LeadForm.newTab",
  "LeadForm.phone",
  "LeadForm.phoneHelper",
  "LeadForm.preferredAt",
  "LeadForm.preferredAtHelper",
  "LeadForm.submit",
  "LeadForm.submitting",
  "LeadForm.success",
  "LocaleSwitcher",
  "Shell.brand",
] as const;

/** What a page's own client islands read, sent by `PageMessages` around them. */
export const pageNamespaces = [
  "ApartmentPage",
  "Catalogue",
  "Lightbox",
  "Media",
  "Share",
  "Status",
] as const;

export type PageNamespace = (typeof pageNamespaces)[number];

type Tree = { [key: string]: unknown };

/** The named parts of a catalogue, each kept under its own path. */
export function pickMessages(messages: Tree, names: readonly string[]): Tree {
  const picked: Tree = {};
  for (const name of names) {
    const [namespace, key] = name.split(".") as [string, string | undefined];
    const value = messages[namespace];
    if (key === undefined) picked[namespace] = value;
    else {
      picked[namespace] = { ...(picked[namespace] as Tree), [key]: (value as Tree)[key] };
    }
  }
  return picked;
}
