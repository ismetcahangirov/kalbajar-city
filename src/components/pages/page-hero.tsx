import { ArrowDown } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { GridLines } from "@/components/motion/grid-lines";
import type { SceneTheme } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { SplitWord } from "@/components/motion/split-word";
import { Picture } from "@/components/ui/picture";
import { RoundButton } from "@/components/ui/round-button";
import { cx } from "@/lib/cx";
import type { PublicImage } from "@/lib/public/media";

/** The hero's scroll range: from the page top until its bottom leaves the viewport. */
const leaving = "0-0 → 0-100";

type PageHeroProps = {
  /** The page's `h1`, visually hidden: the giant word stands for it. */
  title: string;
  /** The giant word, from `Pages.words.*`, so each locale spreads its own. */
  word: string;
  /** A short line under the word: the page's lead. */
  subtitle?: ReactNode;
  /** The id of the first section, which the round down button scrolls to. */
  next: string;
  theme: SceneTheme;
  /**
   * `photo`: the image full bleed behind the word (only dark images, so the
   * cream text on it passes). `framed`: the image as a centred portrait
   * overlapping the word on the theme's surface. `plain`: no image.
   */
  layout: "photo" | "framed" | "plain";
  image?: PublicImage | null;
};

/**
 * The split-title hero of an inner page (spec §7.3, reference
 * pyzhevsky-pages.md §2.1): the page's word spread edge to edge, the
 * subtitle, a round button down to the first section. It runs under the
 * transparent header (`data-header-overlay`) and leaves with
 * `sectionUnderNext` (A24): while it scrolls away its image sinks by half a
 * viewport and the word by a whole one, eased in, so the next section slides
 * over it. The server renders it at rest, which is also the state on touch,
 * under reduced motion and without script; the image is the LCP candidate
 * and is never hidden.
 */
export async function PageHero({
  title,
  word,
  subtitle,
  next,
  theme,
  layout,
  image,
}: PageHeroProps) {
  const locale = await getLocale();
  const t = await getTranslations("Pages");
  const photo = layout === "photo" && image;
  const framed = layout === "framed" && image;

  return (
    <section
      data-theme={theme}
      data-header-overlay=""
      data-page-hero={layout}
      aria-labelledby="sehife-basliq"
      className={cx(
        "relative isolate flex flex-col overflow-hidden bg-(--t-bg) text-(--t-text)",
        layout === "plain" ? "min-h-[36rem] desk:min-h-[70svh]" : "min-h-svh",
        layout === "plain" && "border-b border-(--t-line)",
      )}
    >
      {photo ? (
        <Scrub
          range={leaving}
          from={{ translate: "0 0svh" }}
          to={{ translate: "0 50svh" }}
          className="absolute inset-0 -z-1"
        >
          <Picture image={image} sizes="100vw" priority />
        </Scrub>
      ) : (
        <GridLines variant="half" />
      )}

      <h1 id="sehife-basliq" className="sr-only">
        {title}
      </h1>

      <Scrub
        range={leaving}
        easing="quadIn"
        from={{ translate: "0 0svh" }}
        to={{ translate: "0 100svh" }}
        className={cx(
          "flex flex-1 flex-col pt-[calc(var(--header-height)+var(--u)*4)]",
          framed
            ? "justify-center desk:justify-start desk:pt-[calc(var(--header-height)+var(--u)*6)]"
            : "justify-center",
        )}
      >
        <SplitWord
          word={word}
          lang={locale}
          className={cx(
            "px-layout text-word uppercase",
            photo ? "text-(--t-heading)" : "text-(--t-primary)",
          )}
        />
        {framed && (
          // Overlaps the word's lower half, as the reference's contact render.
          <div className="relative mx-auto -mt-[0.4em] aspect-[4/5] w-[min(15rem,60vw)] text-word">
            <Picture image={image} sizes="(width >= 41.75rem) 15rem, 60vw" priority />
          </div>
        )}
        {subtitle && (
          <p
            className={cx(
              "mx-layout mt-u2 max-w-[24rem] text-center text-label uppercase",
              // Under the word at the right (centred under a framed image);
              // on a photo the small text is cream, the strongest pair.
              framed ? "self-center" : "self-center desk:self-end desk:text-end",
              photo ? "text-(--t-text)" : "text-(--t-small)",
            )}
          >
            {subtitle}
          </p>
        )}
      </Scrub>

      <div className="flex px-layout pt-u4 pb-u">
        <RoundButton
          as="a"
          href={`#${next}`}
          label={t("down")}
          tone={photo ? "cream" : "line"}
          icon={
            <ArrowDown width={16} height={16} strokeWidth={1.5} aria-hidden focusable={false} />
          }
          className="-ms-[0.4375rem]"
        />
      </div>
    </section>
  );
}
