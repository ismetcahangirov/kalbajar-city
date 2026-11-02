import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { EmptyState } from "@/components/content/empty-state";
import { Lightbox } from "@/components/content/lightbox";
import { PageHead } from "@/components/content/page-head";
import { Container, Section } from "@/components/ui";
import { formatNumber } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { getGallery } from "@/lib/public/gallery";
import { categoryParam } from "@/lib/public/query";

// The filter is in the query string and the data in the database: rendered
// per request and sent complete (CLAUDE.md → Data and state).
export const instant = false;

/**
 * Only the unfiltered gallery is indexed; a filtered view points search
 * engines to it (#21).
 */
export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/qalereya">): Promise<Metadata> {
  const t = await getTranslations("Gallery");
  const metadata: Metadata = { title: t("title"), description: t("description") };
  if ((await searchParams).kateqoriya === undefined) return metadata;
  const locale = (await getLocale()) as Locale;
  const path = getPathname({ href: "/qalereya", locale });
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    ...metadata,
    robots: { index: false, follow: true },
    alternates: { canonical: site ? new URL(path, site).toString() : path },
  };
}

const chip =
  "inline-flex min-h-target items-center gap-2 rounded-full border px-4 text-body font-medium";

/**
 * `/qalereya` (#21): category links (`?kateqoriya=<slug>`), a masonry of CSS
 * columns, and the lightbox.
 */
export default async function GalleryPage({ searchParams }: PageProps<"/[locale]/qalereya">) {
  await connection();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Gallery");
  const gallery = await getGallery(locale);
  const active = categoryParam(
    (await searchParams).kateqoriya,
    gallery.categories.map((category) => category.slug),
  );
  const items = active ? gallery.items.filter((item) => item.category === active) : gallery.items;

  const filters = [
    {
      key: "all",
      label: t("all"),
      count: gallery.items.length,
      href: getPathname({ href: "/qalereya", locale }),
      current: active === null,
      lang: undefined,
    },
    ...gallery.categories.map((category) => ({
      key: category.slug,
      label: category.name.value,
      count: category.count,
      href: getPathname({
        href: { pathname: "/qalereya", query: { kateqoriya: category.slug } },
        locale,
      }),
      current: active === category.slug,
      lang: category.name.fallback ? category.name.locale : undefined,
    })),
  ];

  return (
    <Section>
      <Container className="flex flex-col gap-block">
        <PageHead title={t("title")} lead={t("lead")} />

        {items.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <>
            {gallery.categories.length > 1 && (
              // Filters never animate (motion-system.md).
              <nav aria-label={t("filter")}>
                <ul className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <li key={filter.key}>
                      <Link
                        href={filter.href}
                        aria-current={filter.current ? "page" : undefined}
                        className={cx(
                          chip,
                          filter.current
                            ? "border-action bg-action text-action-text"
                            : "border-border-strong hover:bg-surface-alt",
                        )}
                      >
                        <span lang={filter.lang}>{filter.label}</span>
                        <span className="text-small">{formatNumber(filter.count, locale)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {/* Keyed by the filter, so the lightbox's state starts over with the new set. */}
            <Lightbox
              key={active ?? "all"}
              layout="masonry"
              items={items}
              sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 50vw, 100vw"
            />
          </>
        )}
      </Container>
    </Section>
  );
}
