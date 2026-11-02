import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { formatArea, formatNumber } from "@/i18n/format";
import { routing } from "@/i18n/routing";
import { getPublicApartment } from "@/lib/public/apartments";
import { ogImageSize } from "@/lib/seo/metadata";
import { ogImage } from "@/lib/seo/og";

export const size = ogImageSize;
export const contentType = "image/png";

/** An apartment's card: its block and number, rooms, area, floor and status in words. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  await connection();
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const apartment = await getPublicApartment(slug, locale);
  if (!apartment) notFound();

  const [meta, apartments, card, status] = await Promise.all([
    getTranslations({ locale, namespace: "Metadata" }),
    getTranslations({ locale, namespace: "Apartments" }),
    getTranslations({ locale, namespace: "OgImage" }),
    getTranslations({ locale, namespace: "Status" }),
  ]);
  return ogImage({
    eyebrow: meta("title"),
    title: apartments("name", { block: apartment.block.name.value, number: apartment.number }),
    details: [
      card("rooms", { rooms: apartment.rooms }),
      formatArea(Number(apartment.areaTotal), locale),
      card("floor", { floor: formatNumber(apartment.floor, locale) }),
      status(apartment.status),
    ],
  });
}
