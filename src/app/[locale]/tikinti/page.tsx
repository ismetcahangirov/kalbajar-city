import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { EmptyState } from "@/components/content/empty-state";
import { Lightbox } from "@/components/content/lightbox";
import { ProgressBar } from "@/components/content/progress-bar";
import { RichText } from "@/components/content/rich-text";
import { Localized } from "@/components/home/localized";
import { GridLines } from "@/components/motion/grid-lines";
import { Reveal } from "@/components/motion/reveal";
import { SplitWord } from "@/components/motion/split-word";
import { PageHero } from "@/components/pages/page-hero";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { ChapterTabs } from "@/components/shell/chapter-tabs";
import { NextChapter } from "@/components/shell/next-chapter";
import { ArrowBlock } from "@/components/ui/arrow-block";
import { defaultImage } from "@/content/defaults";
import { formatPercent } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { getConstructionTimeline, type PublicConstructionMedia } from "@/lib/public/construction";
import { pageMetadata } from "@/lib/seo/page-metadata";

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
 * `/tikinti` after the reference's parking and engineering blocks: the split
 * title, the overall progress as a staircase word (A16) over its hairline
 * bar, then one entry per month, newest first, as alternating text blocks
 * and images (photos open in the lightbox; the video never autoplays).
 * Construction photos are real data: none has a default image.
 */
export default async function ConstructionPage() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Construction");
  const words = await getTranslations("Pages.words");
  const shell = await getTranslations("Shell");
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
      <PageHero
        title={t("title")}
        word={words("construction")}
        subtitle={t("lead")}
        next={latest ? "irelileyis" : "aylar"}
        theme="darker"
        layout="framed"
        image={defaultImage("page.tikinti", locale)}
      />

      {latest && (
        <section
          id="irelileyis"
          data-theme="dark-alt"
          aria-labelledby="irelileyis-basliq"
          className="relative isolate flex flex-col gap-u4 overflow-hidden bg-(--t-bg) py-u6 text-(--t-text) desk:py-u9"
        >
          <GridLines variant="half" />
          <h2 id="irelileyis-basliq" className="px-layout text-label uppercase">
            {t("overall")} · {t("asOf", { month: monthName(latest.month) })}
          </h2>
          <SplitWord
            word={formatPercent(latest.progressPercent, locale)}
            mode="staircase"
            mobile
            lang={locale}
            className="px-layout text-word text-(--t-primary)"
          />
          <ProgressBar
            id="umumi-irelileyis"
            value={latest.progressPercent}
            label={t("progress", { percent: formatPercent(latest.progressPercent, locale) })}
            className="mx-layout max-w-(--container-prose)"
          />
        </section>
      )}

      <section
        id="aylar"
        data-theme="light"
        aria-labelledby="aylar-basliq"
        className="flex flex-col gap-u4 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
      >
        <h2
          id="aylar-basliq"
          className="text-title break-words hyphens-auto text-(--t-primary) uppercase"
        >
          {t("updatesTitle")}
        </h2>
        {updates.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={
              <ArrowBlock
                as="a"
                href={`${getPathname({ href: "/elaqe", locale })}#baxis`}
                tone="ink"
              >
                {t("emptyAction")}
              </ArrowBlock>
            }
          />
        ) : (
          <ol aria-label={t("timeline")} className="flex flex-col">
            {updates.map((update, index) => {
              const month = monthName(update.month);
              const id = `ay-${update.month.slice(0, 7)}`;
              const images = update.media.flatMap((item) =>
                item.kind === "image"
                  ? [{ id: item.id, image: item.image, caption: item.caption }]
                  : [],
              );
              const videos = update.media.filter((item): item is Video => item.kind === "video");
              const media = images.length > 0 || videos.length > 0;
              return (
                <li
                  key={update.id}
                  aria-labelledby={id}
                  className="grid gap-u4 border-t border-(--t-line) py-u4 desk:grid-cols-2 desk:gap-u2"
                >
                  {/* Text and images alternate sides, month by month. */}
                  <div
                    className={cx(
                      "flex flex-col gap-u2",
                      media && index % 2 === 1 && "desk:order-2 desk:ps-u",
                      media && index % 2 === 0 && "desk:pe-u",
                    )}
                  >
                    <h2 id={id} className="text-label text-(--t-small) uppercase">
                      <time dateTime={update.month.slice(0, 7)}>{month}</time>
                    </h2>
                    <Reveal kind="text" as="h3" className="text-lead-lg">
                      <Localized text={update.title} />
                    </Reveal>
                    <p className="text-label text-(--t-small) uppercase">
                      {t("monthProgress", {
                        percent: formatPercent(update.progressPercent, locale),
                      })}
                    </p>
                    {update.body && (
                      <RichText text={update.body} className="max-w-(--container-prose)" />
                    )}
                  </div>
                  {media && (
                    <div className="flex min-w-0 flex-col gap-u2">
                      {images.length > 0 && (
                        <Lightbox
                          layout="grid"
                          items={images}
                          columns={2}
                          sizes="(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw"
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
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <StructuredData
        locale={locale}
        nodes={[await breadcrumbs(locale, [{ name: t("title"), href: "/tikinti" }])]}
      />
      {latest && (
        <ChapterTabs
          label={shell("sections")}
          tabs={[
            { id: "irelileyis", label: t("tabs.progress") },
            { id: "aylar", label: t("tabs.updates") },
          ]}
        />
      )}
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
    <figure className="flex flex-col gap-u">
      <div
        className="overflow-hidden bg-(--t-line)"
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
        <figcaption className="text-small-t text-(--t-small)">
          <Localized text={video.caption} />
        </figcaption>
      )}
    </figure>
  );
}
