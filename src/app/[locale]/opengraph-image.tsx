import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { routing } from "@/i18n/routing";
import { ogImage } from "@/lib/seo/og";
import { ogImageSize } from "@/lib/seo/metadata";

export const size = ogImageSize;
export const contentType = "image/png";

/** The site's card, for every page without one of its own. */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  // The card shows the host the server runs on, not the one the build saw.
  await connection();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return ogImage({ eyebrow: t("title"), title: t("description") });
}
