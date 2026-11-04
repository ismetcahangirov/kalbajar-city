import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { EmptyState } from "@/components/content/empty-state";
import { Lightbox } from "@/components/content/lightbox";
import { PageHead } from "@/components/content/page-head";
import { ProgressBar } from "@/components/content/progress-bar";
import { RichText } from "@/components/content/rich-text";
import { Localized } from "@/components/home/localized";
import { FadeUp } from "@/components/motion";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { Button, Container, Heading, Icon, Section, Text } from "@/components/ui";
import { formatPercent } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getConstructionTimeline, type PublicConstructionMedia } from "@/lib/public/construction";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { NextChapter } from "@/components/shell/next-chapter";

// Reads the database per request and sends the page complete, not streamed
// behind Suspense (CLAUDE.md → Data and state). The data is cached and
// tagged, so a published update shows on the next request.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Construction");
  return pageMetadata({
    locale,
    href: "/tikinti",
    title: t("title"),
    description: t("description"),
  });
}

type Video = Extract<PublicConstructionMedia, { kind: "video" }>;

/**
 * `/tikinti` (#21): the overall progress, then one entry per month, newest
 * first, with its note, photos (opening in the lightbox) and video.
 */
export default async function ConstructionPage() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Construction");
  const format = await getFormatter();
  const updates = await getConstructionTimeline(locale);
  const latest = updates[0];

  const monthName = (month: string) =>
    format.dateTime(new Date(`${month}T00:00:00Z`), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <>
      <Section>
        <Container className="flex flex-col gap-block">
          <PageHead title={t("title")} lead={t("lead")}>
            {latest && (
              <div className="flex max-w-(--container-prose) flex-col gap-2 pt-4">
                <Text size="small" tone="muted">
                  {t("overall")} · {t("asOf", { month: monthName(latest.month) })}
                </Text>
                <ProgressBar
                  id="umumi-irelileyis"
                  value={latest.progressPercent}
                  label={t("progress", { percent: formatPercent(latest.progressPercent, locale) })}
                />
              </div>
            )}
          </PageHead>

          {updates.length === 0 ? (
            <EmptyState
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={
                <Button
                  href={`${getPathname({ href: "/elaqe", locale })}#baxis`}
                  variant="link"
                  trailingIcon={<Icon icon={ArrowRight} />}
                >
                  {t("emptyAction")}
                </Button>
              }
            />
          ) : (
            <ol aria-label={t("timeline")} className="flex flex-col">
              {updates.map((update) => {
                const month = monthName(update.month);
                const id = `ay-${update.month.slice(0, 7)}`;
                const images = update.media.flatMap((item) =>
                  item.kind === "image"
                    ? [{ id: item.id, image: item.image, caption: item.caption }]
                    : [],
                );
                const videos = update.media.filter((item): item is Video => item.kind === "video");
                return (
                  <li
                    key={update.id}
                    aria-labelledby={id}
                    className="grid gap-6 border-t border-border py-block lg:grid-cols-12 lg:gap-gutter"
                  >
                    <FadeUp className="flex flex-col gap-3 lg:col-span-4">
                      <Heading as="h2" size="heading" id={id}>
                        <time dateTime={update.month.slice(0, 7)}>{month}</time>
                      </Heading>
                      <Heading as="h3" size="title">
                        <Localized text={update.title} />
                      </Heading>
                      <Text size="small" tone="muted">
                        {t("monthProgress", {
                          percent: formatPercent(update.progressPercent, locale),
                        })}
                      </Text>
                    </FadeUp>
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
                      {update.body && (
                        <RichText text={update.body} className="max-w-(--container-prose)" />
                      )}
                      {images.length > 0 && (
                        <Lightbox
                          layout="grid"
                          items={images}
                          sizes="(min-width: 64rem) 22vw, (min-width: 40rem) 50vw, 100vw"
                        />
                      )}
                      {videos.map((video) => (
                        <ConstructionVideo
                          key={video.id}
                          video={video}
                          fallbackLabel={t("video", { month })}
                        />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Container>
        <StructuredData
          locale={locale}
          nodes={[await breadcrumbs(locale, [{ name: t("title"), href: "/tikinti" }])]}
        />
      </Section>
      <NextChapter current="/tikinti" />
    </>
  );
}

/**
 * The stored MP4 with its controls. It never autoplays here and loads
 * nothing until the visitor presses play (`preload="none"`); its frame is
 * sized from the file, so nothing shifts. Until then it shows the poster
 * frame the media library captured (#25), or the player's own empty frame.
 */
function ConstructionVideo({ video, fallbackLabel }: { video: Video; fallbackLabel: string }) {
  const { width, height } = video.video;
  return (
    <figure className="flex flex-col gap-3">
      <div
        className="overflow-hidden rounded-md bg-surface-alt"
        style={{ aspectRatio: width && height ? `${width} / ${height}` : "16 / 9" }}
      >
        <video
          controls
          preload="none"
          playsInline
          poster={video.video.poster?.src}
          aria-label={video.label?.value ?? fallbackLabel}
          className="size-full"
        >
          <source src={video.video.src} type={video.video.type} />
        </video>
      </div>
      {video.caption && (
        <Text as="figcaption" size="small" tone="muted">
          <Localized text={video.caption} />
        </Text>
      )}
    </figure>
  );
}
