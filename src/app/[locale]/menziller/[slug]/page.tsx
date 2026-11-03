import { ArrowLeft, ArrowRight, CalendarCheck, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { ApartmentCard } from "@/components/apartments/apartment-card";
import { AreaTable } from "@/components/apartments/area-table";
import { DeferredLeadForm } from "@/components/leads/deferred-lead-form";
import { PlanViewer } from "@/components/apartments/plan-viewer";
import { ShareActions } from "@/components/apartments/share-actions";
import { StatusBadge } from "@/components/apartments/status-badge";
import { Localized } from "@/components/home/localized";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { FadeUp, ImageReveal } from "@/components/motion";
import {
  Button,
  buttonClass,
  Container,
  Eyebrow,
  Heading,
  Icon,
  Picture,
  Section,
  Text,
  type Tone,
} from "@/components/ui";
import { mainPhone } from "@/config/contacts";
import { formatArea, formatNumber, formatPrice, telHref } from "@/i18n/format";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { getPublicApartment, listSimilarApartments } from "@/lib/public/apartments";
import { apartmentNodes } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { absoluteUrl, siteOrigin } from "@/lib/seo/url";
import { apartmentSlugParamsSchema, type PublicApartmentDetail } from "@/shared/apartments";

// Rendered per request and sent complete, not streamed behind Suspense
// (CLAUDE.md → Data and state): the slug is only known at request time, and
// a status change in the console must show on the next request.
export const instant = false;

async function load(params: PageProps<"/[locale]/menziller/[slug]">["params"]) {
  const parsed = apartmentSlugParamsSchema.safeParse(await params);
  if (!parsed.success) return null;
  const locale = (await getLocale()) as Locale;
  const apartment = await getPublicApartment(parsed.data.slug, locale);
  return apartment ? { apartment, locale } : null;
}

async function nameOf(apartment: PublicApartmentDetail): Promise<string> {
  const t = await getTranslations("Apartments");
  return t("name", { block: apartment.block.name.value, number: apartment.number });
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/menziller/[slug]">): Promise<Metadata> {
  await connection();
  const found = await load(params);
  if (!found) return {};
  const { apartment, locale } = found;
  const t = await getTranslations("ApartmentPage");
  const name = await nameOf(apartment);
  const area = formatArea(Number(apartment.areaTotal), locale);
  return pageMetadata({
    locale,
    href: { pathname: "/menziller/[slug]", params: { slug: apartment.slug } },
    title: t("metaTitle", { name, rooms: apartment.rooms, area }),
    description: t("description", {
      name,
      rooms: apartment.rooms,
      area,
      floor: formatNumber(apartment.floor, locale),
    }),
    image: "own",
  });
}

export default async function ApartmentPage({ params }: PageProps<"/[locale]/menziller/[slug]">) {
  await connection();
  const found = await load(params);
  if (!found) notFound();
  const { apartment, locale } = found;
  const t = await getTranslations("ApartmentPage");
  const form = await getTranslations("LeadForm");
  const name = await nameOf(apartment);
  const similar = await listSimilarApartments(apartment, locale);
  const apartments = await getTranslations("Apartments");
  const origin = siteOrigin();
  const href = { pathname: "/menziller/[slug]", params: { slug: apartment.slug } } as const;

  const facts: Array<{ label: string; value: ReactNode }> = [
    { label: t("rooms"), value: formatNumber(apartment.rooms, locale) },
    { label: t("area"), value: formatArea(Number(apartment.areaTotal), locale) },
    { label: t("floor"), value: formatNumber(apartment.floor, locale) },
    { label: t("block"), value: <Localized text={apartment.block.name} /> },
    { label: t("building"), value: <Localized text={apartment.building.name} /> },
    { label: t("layout"), value: apartment.layout.code },
  ];

  // Later sections alternate surfaces, whichever of them have content.
  const sections = [
    apartment.roomAreas.length > 0 || apartment.description ? "breakdown" : null,
    apartment.gallery.length > 0 ? "gallery" : null,
    similar.length > 0 ? "similar" : null,
  ].filter((section) => section !== null);
  const tone = (section: string): Tone =>
    sections.indexOf(section) % 2 === 0 ? "limestone" : "paper";

  return (
    <>
      <Container className="flex flex-col gap-6 pt-6 pb-section">
        <Link
          href="/menziller"
          className={buttonClass({ variant: "link", className: "self-start no-underline" })}
          data-print-hidden=""
        >
          <Icon icon={ArrowLeft} />
          {t("back")}
        </Link>

        <div className="grid gap-block lg:grid-cols-12 lg:gap-gutter">
          <div className="flex flex-col gap-6 lg:order-2 lg:col-span-5">
            <div className="flex flex-col gap-4">
              <Eyebrow>
                <Localized text={apartment.building.name} />
              </Eyebrow>
              <Heading as="h1" size="display">
                {name}
              </Heading>
              <StatusBadge status={apartment.status} className="self-start" />
            </div>

            {apartment.status !== "sold" && (
              <div className="flex flex-col gap-1">
                <p className="text-small text-text-muted">{t("price")}</p>
                <p className="text-heading">
                  {apartment.price
                    ? formatPrice(apartment.price.amount, apartment.price.currency, locale)
                    : t("priceOnRequest")}
                </p>
              </div>
            )}

            <dl
              aria-label={t("facts")}
              className="grid grid-cols-2 gap-x-gutter border-t border-border"
            >
              {facts.map((fact) => (
                <div key={fact.label} className="flex flex-col gap-1 border-b border-border py-4">
                  <dt className="text-small text-text-muted">{fact.label}</dt>
                  <dd className="text-title">{fact.value}</dd>
                </div>
              ))}
            </dl>

            {apartment.status !== "sold" && (
              <div className="flex flex-wrap gap-3" data-print-hidden="">
                <Button href={telHref(mainPhone)} leadingIcon={<Icon icon={Phone} />}>
                  {t("call")}
                </Button>
                <Button
                  href={getPathname({ href: "/elaqe", locale })}
                  variant="secondary"
                  leadingIcon={<Icon icon={CalendarCheck} />}
                >
                  {t("viewing")}
                </Button>
              </div>
            )}

            <ShareActions title={name} />

            {apartment.status !== "sold" && (
              <section
                aria-labelledby="sorgu-basliq"
                className="flex flex-col gap-6 rounded-md bg-surface-raised p-6"
                data-print-hidden=""
              >
                <div className="flex flex-col gap-2">
                  <Heading as="h2" size="title" id="sorgu-basliq">
                    {form("heading.inquiry")}
                  </Heading>
                  <Text tone="muted">{form("intro.inquiry")}</Text>
                </div>
                <DeferredLeadForm
                  reserve="apartment"
                  type="inquiry"
                  // "Mənzil 102 (A blok) haqqında": door numbers repeat across blocks.
                  apartment={{
                    slug: apartment.slug,
                    label: `${apartment.number} (${apartment.block.name.value})`,
                  }}
                  labelledBy="sorgu-basliq"
                />
              </section>
            )}
          </div>

          <figure className="flex flex-col gap-4 lg:order-1 lg:col-span-7">
            <figcaption className="text-title">{t("plan")}</figcaption>
            {apartment.plan ? (
              <PlanViewer image={apartment.plan} name={name} locale={locale} />
            ) : (
              <Text tone="muted" className="rounded-md bg-surface-alt p-6">
                {t("planMissing")}
              </Text>
            )}
          </figure>
        </div>
      </Container>

      {sections.includes("breakdown") && (
        <Section tone={tone("breakdown")} aria-labelledby="otaqlar">
          <Container className="grid gap-block lg:grid-cols-12 lg:gap-gutter">
            <div className="flex flex-col gap-block lg:col-span-7">
              <FadeUp>
                <Heading as="h2" size="heading" id="otaqlar">
                  {t("breakdown")}
                </Heading>
              </FadeUp>
              {apartment.roomAreas.length > 0 && (
                <AreaTable
                  id="otaqlar"
                  rooms={apartment.roomAreas}
                  total={apartment.areaTotal}
                  locale={locale}
                />
              )}
            </div>
            {apartment.description && (
              <Text size="body-lg" className="max-w-(--container-prose) lg:col-span-5">
                <Localized text={apartment.description} />
              </Text>
            )}
          </Container>
        </Section>
      )}

      {sections.includes("gallery") && (
        <Section tone={tone("gallery")} aria-labelledby="qalereya">
          <Container className="flex flex-col gap-block">
            <FadeUp>
              <Heading as="h2" size="heading" id="qalereya">
                {t("gallery")}
              </Heading>
            </FadeUp>
            <ul className="grid gap-gutter sm:grid-cols-2">
              {apartment.gallery.map((image, i) => {
                const frame = "relative aspect-grid overflow-hidden rounded-md";
                const media = <Picture image={image} sizes="(min-width: 40rem) 50vw, 100vw" />;
                return (
                  <li key={image.src} className={cx(i === 0 && "sm:col-span-2")}>
                    {/* Only the first image enters with the reveal (motion budget). */}
                    {i === 0 ? (
                      <ImageReveal className={frame}>{media}</ImageReveal>
                    ) : (
                      <div className={frame}>{media}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Container>
        </Section>
      )}

      {sections.includes("similar") && (
        <Section tone={tone("similar")} aria-labelledby="oxsar" data-print-hidden="">
          <Container className="flex flex-col gap-block">
            <FadeUp className="flex flex-wrap items-end justify-between gap-4">
              <Heading as="h2" size="heading" id="oxsar">
                {t("similar")}
              </Heading>
              <Link
                href={{ pathname: "/menziller", query: { otaq: String(apartment.rooms) } }}
                className={buttonClass({ variant: "link" })}
              >
                {t("similarAll", { rooms: formatNumber(apartment.rooms, locale) })}
                <Icon icon={ArrowRight} />
              </Link>
            </FadeUp>
            <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((item) => (
                <li key={item.slug}>
                  <ApartmentCard apartment={item} locale={locale} pricesVisible={!!item.price} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      <StructuredData
        locale={locale}
        nodes={[
          await breadcrumbs(locale, [
            { name: apartments("title"), href: "/menziller" },
            { name, href },
          ]),
          ...apartmentNodes({
            origin,
            url: absoluteUrl(getPathname({ href, locale }), origin),
            name,
            rooms: apartment.rooms,
            area: Number(apartment.areaTotal),
            floor: apartment.floor,
            status: apartment.status,
            price: apartment.price,
            image: apartment.plan?.src ?? null,
          }),
        ]}
      />
    </>
  );
}
