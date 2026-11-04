import { randomUUID } from "node:crypto";

import { expect, request as playwrightRequest, type Page } from "@playwright/test";

import { connect, databaseUrl } from "@/db/client";
import { locales, type Locale } from "@/i18n/routing";
import { setOwner } from "@/lib/auth/owner";
import type { AdminNews } from "@/shared/content";

/*
 * The public routes the quality suites (#30) walk: every page in
 * `src/i18n/routing.ts` except the /primitivler fixtures, which are a 404 in
 * production, plus the 404 page. The seed has apartments but no articles, so
 * a suite that visits an article publishes one of its own with `withArticle`.
 */

export const localePrefix: Record<Locale, string> = { az: "", en: "/en", ru: "/ru" };

/** A seeded apartment (src/db/seed): blocks A–D, apartments numbered by floor. */
export const apartmentPath = "/menziller/blok-c-menzil-102";

export type PublicRoute = { name: string; path: string; status: number };

export function publicRoutes(articleSlug: string): PublicRoute[] {
  return [
    { name: "home", path: "/", status: 200 },
    { name: "catalogue", path: "/menziller", status: 200 },
    { name: "apartment", path: apartmentPath, status: 200 },
    { name: "complex", path: "/kompleks", status: 200 },
    { name: "about", path: "/haqqimizda", status: 200 },
    { name: "location", path: "/yerlesme", status: 200 },
    { name: "construction", path: "/tikinti", status: 200 },
    { name: "gallery", path: "/qalereya", status: 200 },
    { name: "news", path: "/xeberler", status: 200 },
    { name: "article", path: `/xeberler/${articleSlug}`, status: 200 },
    { name: "contact", path: "/elaqe", status: 200 },
    { name: "privacy", path: "/mexfilik-siyaseti", status: 200 },
    { name: "not-found", path: "/yoxdur", status: 404 },
  ];
}

/** `path` in `locale`: Azerbaijani without a prefix, the home page without a trailing slash. */
export function localized(locale: Locale, path: string): string {
  const prefix = localePrefix[locale];
  return prefix && path === "/" ? prefix : `${prefix}${path}`;
}

export { locales };

/** How far the page scrolls sideways; 0 when nothing overflows. */
export function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Waits for the web fonts, so text is measured in its final face. */
export async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/**
 * Publishes a short article through the console API, as an editor would (so
 * the public caches are revalidated), and returns its slug and a function
 * that deletes it again. Each caller gets its own owner account and slug, so
 * suites running in parallel never share one.
 */
export async function withArticle(
  baseURL: string,
  owner: string,
): Promise<{ slug: string; remove: () => Promise<void> }> {
  const email = `e2e-${owner}-${randomUUID().slice(0, 6)}@test.kalbajarcity.com`;
  const password = "an e2e passphrase that is long";
  const { db, close } = connect(databaseUrl());
  try {
    await setOwner(db, { email, name: "E2E Quality Owner", password });
  } finally {
    await close();
  }

  const api = await playwrightRequest.newContext({ baseURL });
  const signedIn = await api.post("/api/v1/auth/sign-in/email", {
    headers: { origin: baseURL, "x-forwarded-for": `198.51.100.${randomOctet()}` },
    data: { email, password },
  });
  expect(signedIn.status()).toBe(200);

  const slug = `e2e-keyfiyyet-${randomUUID().slice(0, 6)}`;
  const text = (value: string) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
  });
  const created = await api.post("/api/v1/admin/news", {
    data: {
      slug,
      title: {
        az: "Tikinti meydançasında yeni mərhələ",
        en: "A new stage on the building site",
        ru: "Новый этап на строительной площадке",
      },
      excerpt: {
        az: "Karkas işləri başa çatıb.",
        en: "The frame is complete.",
        ru: "Каркас завершён.",
      },
      body: {
        az: text("Karkas işləri başa çatıb, fasad işləri başlayır."),
        en: text("The frame is complete and work on the facade begins."),
        ru: text("Каркас завершён, начинаются работы по фасаду."),
      },
    },
  });
  expect(created.status()).toBe(201);
  const article = (await created.json()) as AdminNews;
  const published = await api.put(`/api/v1/admin/news/${article.id}/publication`, { data: {} });
  expect(published.status()).toBe(200);

  return {
    slug,
    remove: async () => {
      const deleted = await api.delete(`/api/v1/admin/news/${article.id}`);
      expect(deleted.status()).toBe(204);
      await api.dispose();
    },
  };
}

function randomOctet(): number {
  return Math.floor(Math.random() * 250) + 1;
}
