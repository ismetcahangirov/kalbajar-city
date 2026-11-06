import { getTranslations } from "next-intl/server";

import { GridLines } from "@/components/motion/grid-lines";
import { Scene, SceneLayer } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { SplitWord } from "@/components/motion/split-word";
import type { Locale } from "@/i18n/routing";
import type { HomeSection } from "@/lib/public/home";

import { Localized } from "../localized";
import { fullBleed, langOf, Photo } from "./photo";

type AmenitiesProps = Extract<HomeSection, { kind: "amenities" }> & { locale: Locale };

/** A21: the window in the middle of the screen, then the full screen. */
const windowClip = { closed: "inset(31.4% 25vw)", open: "inset(0% 0vw)" };

/**
 * S7 (pyzhevsky-home.md §3) on the sand layer: the title as the lead
 * top-left and the giant word at the foot, spreading as the scene arrives
 * (A14); then a window in the middle opens to the full screen while its
 * image zooms (A21), and up to four amenities appear as labels in columns
 * at its foot once it is open. The labels sit on a solid band: the default
 * landscape is too light under small text. Stacked (phones, reduced
 * motion), the window is simply open.
 */
export async function Amenities({ title, items, window, locale }: AmenitiesProps) {
  const t = await getTranslations("Home.words");
  const labels = items.slice(0, 4);

  return (
    <Scene theme="sand" length={3} aria-labelledby="ustunlukler">
      <SceneLayer
        stacked="auto"
        className="isolate flex flex-col justify-between gap-u12 pt-u12 pb-u3 desk:pt-u6"
      >
        <GridLines variant="half" />
        <h2
          id="ustunlukler"
          lang={langOf(title)}
          className="trim-cap max-w-[30rem] px-layout text-lead text-(--t-heading)"
        >
          {title.value}
        </h2>
        <SplitWord
          word={t("amenities")}
          mode="spread"
          trigger="scene"
          range="100-0 → 0-0"
          lang={locale}
          className="px-layout text-word text-(--t-primary) uppercase"
        />
      </SceneLayer>
      <SceneLayer data-theme="dark">
        <Scrub
          trigger="scene"
          range="0-0 → -100-0"
          easing="quadInOut"
          from={{ clipPath: windowClip.closed }}
          to={{ clipPath: windowClip.open }}
          className="relative isolate size-full overflow-hidden"
        >
          <Scrub
            trigger="scene"
            range="0-0 → -100-0"
            easing="quadInOut"
            from={{ scale: "0.85" }}
            to={{ scale: "1" }}
            className="size-full"
          >
            <Scrub
              trigger="scene"
              range="-100-0 → -200-0"
              from={{ scale: "1" }}
              to={{ scale: "1.15" }}
              className="size-full"
            >
              <Photo image={window} sizes={fullBleed} />
            </Scrub>
          </Scrub>
          {labels.length > 0 && (
            <Scrub
              trigger="scene"
              range="-75-0 → -100-0"
              easing="quadInOut"
              from={{ opacity: 0 }}
              to={{ opacity: 1 }}
              className="absolute inset-x-0 top-1/2 -translate-y-1/2"
            >
              <ul className="grid grid-cols-2 bg-(--t-bg) desk:grid-cols-4">
                {labels.map((item) => (
                  <li
                    key={item.icon + item.title.value}
                    className="border-t border-(--t-line-alt) px-u py-u3 text-center text-label text-(--t-text) uppercase desk:border-s desk:border-t-0 desk:first:border-s-0"
                  >
                    <Localized text={item.title} />
                  </li>
                ))}
              </ul>
            </Scrub>
          )}
        </Scrub>
      </SceneLayer>
    </Scene>
  );
}
