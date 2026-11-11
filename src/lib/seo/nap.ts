import "server-only";

import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { getSiteContacts } from "@/lib/public/site";

import { confirmedContacts } from "./confirmed-contacts";

/**
 * The complex's name, address and phone as machines read them (#29): the
 * `ApartmentComplex` and `Organization` structured data and `llms.txt`.
 * Local search ranks a business by how consistently these three appear, so
 * every machine-readable output takes them from here, and here takes them
 * from the same sources the pages do: the name is the wordmark's
 * (`Shell.brand`), the phones and the address are the console's contacts
 * (`getSiteContacts`), which the header, footer and contact page show. A
 * seeded stand-in is left out (`confirmedContacts`): the page shows it,
 * machines do not repeat it.
 */
export type Nap = {
  name: string;
  /** In the requested locale; null until the owner has saved or confirmed it (#7). */
  address: string | null;
  /** E.164, the main line first. */
  phones: string[];
  /** The main line, which the call buttons dial. */
  telephone: string;
};

export async function getNap(locale: Locale): Promise<Nap> {
  const [contacts, shell] = await Promise.all([
    getSiteContacts(locale).then(confirmedContacts),
    getTranslations({ locale, namespace: "Shell" }),
  ]);
  return {
    name: shell("brand"),
    address: contacts.address?.value ?? null,
    phones: contacts.phones,
    telephone: contacts.mainPhone,
  };
}
