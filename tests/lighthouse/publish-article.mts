// Publishes the article the Lighthouse job measures (#30): the seed has no
// articles, and an article page is one of the four the performance budget
// is checked on. Run against a fresh database before the server starts, so
// no cache holds an older answer. Idempotent: an existing row is left alone.
import { existsSync } from "node:fs";

import { connect, databaseUrl } from "../../src/db/client";
import { news } from "../../src/db/schema/content";

if (existsSync(".env")) process.loadEnvFile(".env");

const slug = "lighthouse-meqale";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }],
});

const { db, close } = connect(databaseUrl());
try {
  await db
    .insert(news)
    .values({
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
        az: doc("Karkas işləri başa çatıb, fasad işləri başlayır."),
        en: doc("The frame is complete and work on the facade begins."),
        ru: doc("Каркас завершён, начинаются работы по фасаду."),
      },
      status: "published",
      publishedAt: new Date(),
    })
    .onConflictDoNothing({ target: news.slug });
  console.log(`/xeberler/${slug}`);
} finally {
  await close();
}
