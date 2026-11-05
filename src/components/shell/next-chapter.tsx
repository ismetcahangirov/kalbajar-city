import { getLocale, getTranslations } from "next-intl/server";

import { Picture } from "@/components/ui/picture";
import { defaultImage } from "@/content/defaults";
import type { Locale } from "@/i18n/routing";

import { chapterImage, nextChapter, type ChapterHref } from "./navigation";
import { NextChapterLink } from "./next-chapter-link";

/**
 * The "NÖVBƏTİ" teaser (reference pyzhevsky-pages.md §1.7): the next
 * chapter's `page.*` image full bleed, 480 px tall (300 px on phones), its
 * name in `--text-title`, and a 120 px "KEÇ" button that follows the pointer
 * on fine pointers. The whole teaser is one link. A chapter page renders it
 * as its last block, right above the footer:
 *
 *   <NextChapter current="/kompleks" />
 *
 * The order is `chapters` in navigation.ts; the last chapter renders nothing.
 */
export async function NextChapter({ current }: { current: ChapterHref }) {
  const next = nextChapter(current);
  if (!next) return null;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Shell");
  const nav = await getTranslations("Navigation");
  const image = { ...defaultImage(chapterImage(next.href as ChapterHref), locale), alt: "" };
  const title = nav(next.key);

  return (
    <aside aria-label={t("next")} data-theme="dark" className="relative">
      <NextChapterLink href={next.href} go={t("go")}>
        <span className="absolute inset-0 -z-10">
          <Picture image={image} sizes="100vw" />
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-(image:--gradient-teaser-scrim)"
        />
        {/* The visible copy is the link's name, "Next About" (WCAG 2.5.3, label in name). */}
        <span
          data-teaser-copy=""
          className="flex flex-col items-center gap-u text-center text-cream"
        >
          <span className="text-label uppercase">{t("next")}</span>
          <span className="text-title uppercase">{title}</span>
        </span>
      </NextChapterLink>
    </aside>
  );
}
