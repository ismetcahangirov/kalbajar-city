import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { routing } from "@/i18n/routing";
import { getNewsArticle } from "@/lib/public/news";
import { ogImageSize } from "@/lib/seo/metadata";
import { ogImage } from "@/lib/seo/og";

export const size = ogImageSize;
export const contentType = "image/png";

/** An article's card: its title and publication date. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  await connection();
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const article = await getNewsArticle(locale, slug);
  if (!article) notFound();

  const t = await getTranslations({ locale, namespace: "News" });
  const format = await getFormatter({ locale });
  return ogImage({
    eyebrow: t("title"),
    title: article.title.value,
    details: [format.dateTime(new Date(article.publishedAt), "long")],
  });
}
