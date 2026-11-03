import "server-only";

import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getDb } from "@/db";
import { faq } from "@/db/schema";
import { localize } from "@/i18n/content";
import { formatPhone } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import { factSentences } from "@/lib/facts";
import { llmsTxt, type LlmsDocument, type LlmsLink } from "@/lib/llms";
import { absoluteUrl, siteOrigin } from "@/lib/seo/url";

import { getAboutPage, getSiteContacts } from "./site";

/** The locales `llms.txt` is published in, and where (#29). */
export const llmsFiles = { en: "/llms.txt", az: "/llms-az.txt" } as const satisfies Partial<
  Record<Locale, string>
>;

export type LlmsLocale = keyof typeof llmsFiles;

/**
 * The pages a reader is pointed at, each with its catalogue description.
 * The complex page is left out while it is a placeholder (#19).
 */
const pages = [
  { href: "/menziller", nav: "apartments", namespace: "Catalogue" },
  { href: "/haqqimizda", nav: "about", namespace: "About" },
  { href: "/yerlesme", nav: "location", namespace: "Location" },
  { href: "/tikinti", nav: "construction", namespace: "Construction" },
  { href: "/qalereya", nav: "gallery", namespace: "Gallery" },
  { href: "/xeberler", nav: "news", namespace: "News" },
  { href: "/elaqe", nav: "contact", namespace: "Contact" },
  { href: "/mexfilik-siyaseti", nav: "privacy", namespace: "Privacy" },
] as const;

/** Published FAQ entries in the console's order, in one locale. */
async function getFaq(locale: Locale): Promise<Array<{ question: string; answer: string }>> {
  "use cache";
  cacheTag(publicTags.content);
  cacheLife("days");

  const rows = await getDb()
    .select({ question: faq.question, answer: faq.answer })
    .from(faq)
    .where(eq(faq.status, "published"))
    .orderBy(asc(faq.sortOrder));
  return rows.map((row) => ({
    question: localize(row.question, locale).value,
    answer: localize(row.answer, locale).value,
  }));
}

/**
 * `llms.txt` in one locale: the facts block's sentences, the contacts, the
 * pages and the FAQ, all read from the database. The caller has called
 * `connection()`, so the origin is the server's.
 */
export async function buildLlmsTxt(locale: LlmsLocale, origin: string): Promise<string> {
  const [about, contacts, questions] = await Promise.all([
    getAboutPage(locale),
    getSiteContacts(locale),
    getFaq(locale),
  ]);
  const [meta, t, nav, shell, aboutT, factsT, switcher] = await Promise.all([
    getTranslations({ locale, namespace: "Metadata" }),
    getTranslations({ locale, namespace: "Llms" }),
    getTranslations({ locale, namespace: "Navigation" }),
    getTranslations({ locale, namespace: "Shell" }),
    getTranslations({ locale, namespace: "About" }),
    getTranslations({ locale, namespace: "About.facts" }),
    getTranslations({ locale, namespace: "LocaleSwitcher" }),
  ]);
  const descriptions = await Promise.all(
    pages.map(({ namespace }) => getTranslations({ locale, namespace })),
  );

  const url = (href: Parameters<typeof getPathname>[0]["href"]) =>
    absoluteUrl(getPathname({ href, locale }), origin);

  const sentences = about.facts
    ? factSentences(about.facts, about.developer.name, locale, {
        layouts: about.layouts,
        address: about.address,
      }).map((sentence) => factsT(sentence.key, sentence.values as never))
    : [];

  const lines: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) lines.push({ label, value });
  };
  for (const phone of contacts.phones) add(t("phone"), formatPhone(phone));
  add(t("whatsapp"), contacts.whatsapp && formatPhone(contacts.whatsapp));
  add(t("email"), contacts.email);
  add(t("address"), contacts.address?.value);
  add(t("hours"), contacts.hours?.value);
  add(t("developer"), about.developer.name);
  add(t("developerWebsite"), about.developer.website);
  add("Instagram", contacts.socials.instagram);
  add("Facebook", contacts.socials.facebook);
  add("YouTube", contacts.socials.youtube);
  add("TikTok", contacts.socials.tiktok);

  const links: LlmsLink[] = [
    { title: t("home"), url: url("/"), description: meta("description") },
    ...pages.map(({ href, nav: key }, i) => ({
      title: nav(key),
      url: url(href),
      description: descriptions[i]!("description"),
    })),
  ];

  const languages = (Object.keys(llmsFiles) as LlmsLocale[])
    .filter((other) => other !== locale)
    .map((other) => ({
      title: switcher(other),
      url: absoluteUrl(llmsFiles[other], origin),
    }));

  const doc: LlmsDocument = {
    title: shell("brand"),
    summary: `${meta("description")}. ${shell("place")}.`,
    intro: aboutT("lead"),
    facts: { heading: t("facts"), sentences },
    contacts: { heading: t("contacts"), lines },
    pages: { heading: t("pages"), links },
    faq: { heading: t("faq"), items: questions },
    languages: { heading: t("languages"), links: languages },
  };
  return llmsTxt(doc);
}

/** The route handlers' response, after their `connection()`. */
export async function llmsResponse(locale: LlmsLocale): Promise<Response> {
  return new Response(await buildLlmsTxt(locale, siteOrigin()), {
    // Markdown, served as plain text as llms.txt files usually are, so every
    // reader shows it rather than downloading it.
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
