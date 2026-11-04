import { getLocale, getTranslations } from "next-intl/server";

import { GridLines } from "@/components/motion/grid-lines";
import { HeroSnap } from "@/components/motion/hero-snap";
import { Scene, SceneLayer } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { formatArea, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { graphemes } from "@/lib/motion/split-word";
import type { HomeSection } from "@/lib/public/home";

import { HeroIntro } from "./hero-intro";
import { HeroVideo } from "./hero-video";
import { HeroWordmark } from "./hero-wordmark";
import { Localized } from "../localized";
import { fullBleed, langOf, Photo } from "./photo";

type HeroProps = Extract<HomeSection, { kind: "hero" }>;

/** The catalogue's hero clips and zoom (A5). */
const panelClip = { rest: "inset(0 0 0 66.66%)", full: "inset(0 0 0 0%)" };
const renderZoom = {
  rest: { translate: "5.3% 0", scale: "0.77" },
  full: { translate: "0% 0", scale: "1" },
};

/** The tagline, one span per character inside a mask per word (A4); the text stays one string. */
function Characters({ text, lang }: { text: string; lang?: string }) {
  return text.split(" ").map((word, w) => (
    <span key={w}>
      {w > 0 && " "}
      <span className="inline-flex overflow-clip whitespace-nowrap">
        {graphemes(word, lang).map((char, i) => (
          <span key={i} data-char="" className="block">
            {char}
          </span>
        ))}
      </span>
    </span>
  ));
}

/**
 * S0 (pyzhevsky-home.md §3): over the curtain, the wordmark glyph by glyph,
 * the portrait video tile (the console's film over its poster, or the
 * poster alone) and the tagline in the left two thirds; the render panel
 * in the right third. Server-rendered in its final state: the panel image
 * (the LCP element) is painted at first paint and the film never competes
 * with it. While pinned the first viewport snaps (A43), the panel expands
 * and zooms to full screen (A5), the wordmark peels off (A6) and the row
 * drifts left (A7). The load intro (A1–A4) plays only after the preloader.
 * On phones there is no panel scene: the render follows as a full-width
 * image.
 */
export async function Hero({ title, subtitle, poster, panel, video, chips }: HeroProps) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Home");
  const lang = langOf(title);

  return (
    <Scene
      theme="dark"
      length={2}
      aria-labelledby="hero-title"
      data-home-hero=""
      data-header-overlay=""
      className="bg-(image:--gradient-curtain)"
    >
      <HeroSnap />
      <HeroIntro />
      <SceneLayer stacked="auto" className="isolate">
        <GridLines variant="thirds" draw />
        <Scrub
          trigger="scene"
          range="0-0 → -100-0"
          from={{ translate: "0% 0" }}
          to={{ translate: "-7.29% 0" }}
          className="flex min-h-[119.44vw] flex-col items-center pt-[29.74vw] pb-u3 desk:h-svh desk:min-h-0 desk:w-2/3 desk:pt-[20svh]"
        >
          <div className="relative z-1">
            <HeroWordmark word={t("title")} lang="en" />
          </div>
          <div
            data-hero-tile=""
            className="relative -mt-[1.85vw] aspect-[3/4] w-[33.33vw] desk:w-[16.667vw]"
          >
            <Photo image={poster} sizes="(width >= 41.75rem) 17vw, 34vw" />
            {video && <HeroVideo video={video} />}
          </div>
          <div className="mt-u4 flex max-w-[22rem] flex-col items-center gap-u px-layout text-center">
            <h1 id="hero-title" lang={lang} className="text-label text-(--t-text) uppercase">
              <Characters text={title.value} lang={lang ?? locale} />
            </h1>
            {subtitle && (
              <p className="text-small-t text-(--t-text)">
                <Localized text={subtitle} />
              </p>
            )}
          </div>
          {chips && (
            <ul
              aria-label={t("hero.chips")}
              className="mt-u3 flex flex-wrap justify-center gap-x-u2 gap-y-u px-layout text-label text-(--t-text) uppercase desk:mt-auto"
            >
              <li>{t("hero.chipApartments", { count: chips.apartments })}</li>
              <li>
                {t("hero.chipRooms", {
                  min: formatNumber(chips.roomsMin, locale),
                  max: formatNumber(chips.roomsMax, locale),
                })}
              </li>
              <li>{t("hero.chipArea", { area: formatArea(chips.areaMin, locale) })}</li>
            </ul>
          )}
        </Scrub>
        <Scrub
          trigger="scene"
          range="0-0 → -100-0"
          easing="quadOut"
          from={{ clipPath: panelClip.rest }}
          to={{ clipPath: panelClip.full }}
          data-hero-panel=""
          className="relative h-svh overflow-hidden bg-(image:--gradient-facade) desk:absolute desk:inset-0 desk:h-auto desk:[clip-path:inset(0_0_0_66.66%)]"
        >
          <Scrub
            trigger="scene"
            range="0-0 → -100-0"
            easing="quadOut"
            from={renderZoom.rest}
            to={renderZoom.full}
            className="size-full origin-[120%_100%] desk:translate-x-[5.3%] desk:scale-[0.77]"
          >
            <Photo image={panel} sizes={fullBleed} priority />
          </Scrub>
        </Scrub>
      </SceneLayer>
    </Scene>
  );
}
