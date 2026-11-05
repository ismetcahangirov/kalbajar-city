import type { SiteContacts } from "@/lib/public/site";

/**
 * The contacts with every seeded stand-in left out (#29). The owner chose to
 * show stand-ins on the pages so they are complete (#27), but what machines
 * read — the geo meta, the structured data, `llms.txt` — is copied into
 * search indexes, map pins and AI answers, where a stand-in would be repeated
 * as a fact long after the owner has corrected it. So a value reaches them
 * only once someone has saved or confirmed it in the console.
 */
export function confirmedContacts(contacts: SiteContacts): SiteContacts {
  const confirmed = { ...contacts, standIns: [] };
  for (const field of contacts.standIns) confirmed[field] = null;
  return confirmed;
}
