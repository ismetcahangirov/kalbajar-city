import { t } from "./messages";

/**
 * A WhatsApp chat with the lead, opened with a short Azerbaijani greeting the
 * salesperson can edit before sending.
 */
export function leadWhatsappHref(phone: string, name: string): string {
  const text = t("leads.whatsappGreeting", { name: name.split(/\s+/)[0] ?? name });
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** The `tel:` link for a lead's E.164 phone. */
export function leadTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
