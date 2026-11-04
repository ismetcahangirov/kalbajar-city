import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { AreaTable } from "@/components/apartments/area-table";
import { CurtainLines } from "@/components/apartments/curtain-lines";
import { PlanViewer } from "@/components/apartments/plan-viewer";
import { ShareActions } from "@/components/apartments/share-actions";
import { Localized } from "@/components/home/localized";
import { DeferredLeadForm } from "@/components/leads/deferred-lead-form";
import { FadeUp, ImageReveal } from "@/components/motion";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { Container, Heading, Picture, Section, Text, type Tone } from "@/components/ui";
import { ArrowBlock } from "@/components/ui/arrow-block";
import { FlatCard } from "@/components/ui/flat-card";
import { RoundButton } from "@/components/ui/round-button";
import { Tabs } from "@/components/ui/tabs";
import { mainPhone } from "@/config/contacts";
import { formatArea, formatNumber, formatPrice, formatPricePerArea, telHref } from "@/i18n/format";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { getPublicApartment, listSimilarApartments } from "@/lib/public/apartments";
import { apartmentNodes } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { absoluteUrl, siteOrigin } from "@/lib/seo/url";
import { apartmentSlugParamsSchema, type PublicApartmentDetail } from "@/shared/apartments";

/** Caps text links on the theme, with the 44 px target and a +15 px hit area. */
const textLink =
  "-mx-[0.9375rem] flex min-h-target items-center px-[0.9375rem] text-label text-(--t-small) uppercase underline-offset-4 hover:text-(--t-text) hover:underline";

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
  const catalogue = await getTranslations("Catalogue");
  const status = await getTranslations("Status");
  const origin = siteOrigin();
  const href = { pathname: "/menziller/[slug]", params: { slug: apartment.slug } } as const;

  const facts: Array<{ label: string; value: ReactNode }> = [
    { label: t("block"), value: <Localized text={apartment.block.name} /> },
    { label: t("floor"), value: formatNumber(apartment.floor, locale) },
    { label: t("building"), value: <Localized text={apartment.building.name} /> },
    { label: t("layout"), value: apartment.layout.code },
  ];
  const area = Number(apartment.areaTotal);
  const forSale = apartment.status !== "sold";

  // Later sections alternate surfaces, whichever of them have content.
  const sections = [
    apartment.roomAreas.length > 0 || apartment.description ? "breakdown" : null,
    apartment.gallery.length > 0 ? "gallery" : null,
    forSale ? "inquiry" : null,
  ].filter((section) => section !== null);
  const tone = (section: string): Tone =>
    sections.indexOf(section) % 2 === 0 ? "limestone" : "paper";

  const plan = apartment.plan ? (
    <PlanViewer image={apartment.plan} name={name} locale={locale} />
  ) : (
    <p className="p-u2 text-body">{t("planMissing")}</p>
  );

  return (
    <>
      <div
        data-theme="dark"
        // Small text runs below the curtain's top 70svh here, where sand
        // fails 4.5 : 1, so it takes the text colour (ui-kit.md → Themes).
        className="relative isolate bg-umber bg-(image:--gradient-curtain) bg-no-repeat text-(--t-text) [--t-small:var(--t-text)]"
      >
        <CurtainLines />
        <div className="grid gap-y-u4 pt-u4 pb-u6 lg:grid-cols-3 lg:pb-u12">
          {/* The info column stays in view beside the plan and similar flats. */}
          <div className="flex flex-col px-layout lg:sticky lg:top-[calc(var(--header-height)+var(--u))] lg:self-start">
            <div className="flex items-center justify-between gap-u border-b border-(--t-line) pb-u">
              <div className="-ms-[0.4375rem] flex items-center" data-print-hidden="">
                <RoundButton
                  as="link"
                  href="/menziller"
                  label={t("back")}
                  icon={
                    <ArrowLeft
                      width={16}
                      height={16}
                      strokeWidth={1}
                      aria-hidden
                      focusable={false}
                    />
                  }
                />
                <ShareActions title={name} />
              </div>
              <p className="text-label-xs text-(--t-small) uppercase">
                <Localized text={apartment.building.name} />
              </p>
            </div>

            <h1 className="mt-u2 text-title text-(--t-heading) uppercase">{name}</h1>
            <p className="mt-u flex flex-wrap items-baseline gap-x-u text-lead text-(--t-text) uppercase">
              <span>{catalogue("card.rooms", { rooms: apartment.rooms })}</span>
              <span aria-hidden className="h-[0.7em] w-px self-center bg-(--t-line-alt)" />
              <span className="normal-case">{formatArea(area, locale)}</span>
            </p>
            <p className="mt-u2 text-label text-(--t-text) uppercase">
              <span className="sr-only">{t("status")}: </span>
              <span>{status(apartment.status)}</span>
            </p>

            <dl
              aria-label={t("facts")}
              className="mt-u2 flex flex-col border-t border-(--t-line) pt-u text-body"
            >
              {facts.map((fact) => (
                <div key={fact.label} className="flex justify-between gap-u py-1">
                  <dt className="text-(--t-small)">{fact.label}</dt>
                  <dd className="text-end">{fact.value}</dd>
                </div>
              ))}
            </dl>

            {forSale && (
              <div className="mt-u4 flex flex-wrap items-baseline justify-between gap-x-u2 gap-y-1 border-t border-(--t-line) pt-u">
                <p>
                  <span className="sr-only">{t("price")}: </span>
                  <span className="text-lead">
                    {apartment.price
                      ? formatPrice(apartment.price.amount, apartment.price.currency, locale)
                      : t("priceOnRequest")}
                  </span>
                </p>
                {apartment.price && (
                  <p className="text-small-t text-(--t-small)">
                    <span className="sr-only">{t("pricePerArea")}: </span>
                    {formatPricePerArea(
                      apartment.price.amount,
                      apartment.price.currency,
                      area,
                      locale,
                    )}
                  </p>
                )}
              </div>
            )}

            {forSale && (
              <div className="mt-u2 flex flex-col gap-u" data-print-hidden="">
                <ArrowBlock as="a" href="#sorgu" className="w-full">
                  {t("inquire")}
                </ArrowBlock>
                <div className="flex flex-wrap gap-x-u2">
                  <a href={telHref(mainPhone)} className={textLink}>
                    {t("call")}
                  </a>
                  <Link href="/elaqe" className={textLink}>
                    {t("viewing")}
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-u6 px-layout lg:col-span-2">
            <figure data-theme="light" className="m-0 bg-(--t-bg) text-(--t-text)">
              <figcaption className="sr-only">{t("plan")}</figcaption>
              {apartment.floorPlan ? (
                <Tabs
                  label={t("planTabs")}
                  tabs={[
                    { id: "apartment", label: t("tabApartment"), content: plan },
                    {
                      id: "floor",
                      label: t("tabFloor"),
                      content: (
                        <PlanViewer
                          image={apartment.floorPlan}
                          name={`${name}, ${t("tabFloor")}`}
                          locale={locale}
                          priority={false}
                        />
                      ),
                    },
                  ]}
                />
              ) : (
                plan
              )}
            </figure>

            {similar.length > 0 && (
              <section
                aria-labelledby="oxsar"
                data-print-hidden=""
                className="flex flex-col gap-u2"
              >
                <div className="flex flex-wrap items-end justify-between gap-u border-b border-(--t-line) pb-u">
                  <h2 id="oxsar" className="text-title text-(--t-primary) uppercase">
                    {t("similar")}
                  </h2>
                  <Link
                    href={{ pathname: "/menziller", query: { otaq: String(apartment.rooms) } }}
                    className={textLink}
                  >
                    {t("similarAll", { rooms: formatNumber(apartment.rooms, locale) })}
                  </Link>
                </div>
                <ul className="grid gap-u2 desk:grid-cols-2">
                  {similar.map((item) => (
                    <li key={item.slug}>
                      <FlatCard
                        apartment={item}
                        locale={locale}
                        pricesVisible={!!item.price}
                        titleAs="h3"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>

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

      {forSale && (
        <Section
          tone={tone("inquiry")}
          id="sorgu"
          aria-labelledby="sorgu-basliq"
          data-print-hidden=""
        >
          <Container className="grid gap-block lg:grid-cols-12 lg:gap-gutter">
            <div className="flex flex-col gap-2 lg:col-span-6">
              <Heading as="h2" size="heading" id="sorgu-basliq">
                {form("heading.inquiry")}
              </Heading>
              <Text tone="muted">{form("intro.inquiry")}</Text>
            </div>
            <DeferredLeadForm
              reserve="apartment"
              type="inquiry"
              // About as wide as the column its reserved height was measured in.
              className="lg:col-span-5 lg:col-start-8"
              // "Mənzil 102 (A blok) haqqında": door numbers repeat across blocks.
              apartment={{
                slug: apartment.slug,
                label: `${apartment.number} (${apartment.block.name.value})`,
              }}
              labelledBy="sorgu-basliq"
            />
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
