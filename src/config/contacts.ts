/**
 * Public contacts the seed writes to `settings` and the site falls back to
 * while no valid settings row exists: the phones are the ones on
 * kalbajarcity.com and the Instagram account is the complex's own (both
 * checked 2026-11-01). The WhatsApp number is the mobile line and still needs
 * the owner's confirmation (#7). Pages and the shell read the console's
 * settings through `getSiteContacts()` (#27), never these directly.
 */
export const contacts = {
  /** E.164. The first one is the main line used by the call buttons. */
  phones: ["+994124343232", "+994505535555"],
  whatsapp: "+994505535555",
  instagram: "https://www.instagram.com/kalbajar.city/",
} as const;

/**
 * The phones the site shows, main line first: the console's
 * (`settings.contacts`), or the ones above while no valid row is saved. The
 * shell, the contact page, the structured data, `llms.txt` and the FAQ's
 * `{phone}` all read them through this, so they always name the same number.
 */
export function sitePhones(saved: { phones: string[] } | null | undefined): [string, ...string[]] {
  const [main, ...rest] = saved?.phones.length ? saved.phones : contacts.phones;
  return [main!, ...rest];
}

/**
 * The wa.me link for a number in E.164. With `text`, WhatsApp opens the chat
 * with that message typed in, ready to send (`Shell.whatsappMessage`).
 */
export function whatsappHref(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text?.trim() ? `${base}?text=${encodeURIComponent(text)}` : base;
}
