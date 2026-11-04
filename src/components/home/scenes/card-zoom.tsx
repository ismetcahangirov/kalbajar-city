import { getTranslations } from "next-intl/server";

import { GridLines } from "@/components/motion/grid-lines";
import { Scene, SceneLayer } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { SplitWord } from "@/components/motion/split-word";
import type { Locale } from "@/i18n/routing";
import type { HomeSection } from "@/lib/public/home";

import { Localized } from "../localized";
import { fullBleed, langOf, Photo } from "./photo";

type CardZoomProps = Extract<HomeSection, { kind: "card_zoom" }> & { locale: Locale };

/** A18: the photo splits at the centre and the halves retract to the edges. */
const doors = {
  closed: "polygon(0 0,100% 0,100% 100%,50% 100%,50% 0,50% 0,50% 100%,0 100%)",
  open: "polygon(0 0,100% 0,100% 100%,100% 100%,100% 0,0 0,0 100%,0 100%)",
};
/** A19 */
const iris = {
  point: "inset(50svh 50% calc(100% - 50svh) 50%)",
  open: "inset(0 0 calc(100% - 100svh) 0)",
};

/**
 * S4's intro and S5's middle (pyzhevsky-home.md §3). The first scene's photo
 * carries the giant word; scrolling splits it like doors (A18) while the
 * letters fly outward (A15), uncovering the title on the light ground. Each
 * further scene opens onto its photo through an iris (A19) with the photo
 * drifting up inside it. On phones there are no doors: the photo with its
 * word, then the title, then the other photos, one per screen. A caption
 * sits on a solid surface, never straight on the photo.
 */
export async function CardZoom({ title, scenes, locale }: CardZoomProps) {
  const t = await getTranslations("Home.words");
  const [first, ...rest] = scenes;
  if (!first) return null;

  return (
    <>
      <Scene theme="light" length={3} aria-labelledby="menzereler">
        <SceneLayer data-theme="dark" className="z-1">
          <Scrub
            trigger="scene"
            range="0-0 → -100-0"
            easing="quadIn"
            from={{ clipPath: doors.closed }}
            to={{ clipPath: doors.open }}
            className="absolute inset-0 flex items-center"
          >
            <div className="absolute inset-0">
              <Photo image={first.image} sizes={fullBleed} />
            </div>
            <SplitWord
              word={t("cardZoom")}
              mode="explode"
              trigger="scene"
              range="0-0 → -100-0"
              lang={locale}
              className="relative w-full px-layout text-word text-(--t-heading) uppercase"
            />
          </Scrub>
        </SceneLayer>
        <SceneLayer
          stacked="auto"
          className="isolate flex flex-col items-center justify-center gap-u4 px-layout py-u12 text-center"
        >
          <GridLines variant="quarters" />
          <h2
            id="menzereler"
            lang={langOf(title)}
            className="trim-cap max-w-[45rem] text-lead-lg text-(--t-text) desk:text-(--t-primary)"
          >
            {title.value}
          </h2>
          {first.caption && (
            <p className="max-w-(--container-prose) text-body">
              <Localized text={first.caption} />
            </p>
          )}
        </SceneLayer>
      </Scene>
      {rest.map((scene) => (
        <Scene key={scene.key} as="div" theme="dark" length={2} underPrevious>
          <SceneLayer className="isolate">
            <Scrub
              trigger="scene"
              range="0-0 → -100-0"
              easing="quadIn"
              from={{ clipPath: iris.point }}
              to={{ clipPath: iris.open }}
              className="absolute inset-0 overflow-hidden"
            >
              <Scrub
                trigger="scene"
                range="0-0 → -100-0"
                from={{ translate: "0 0%" }}
                to={{ translate: "0 -23%" }}
                className="h-[130%]"
              >
                <Photo image={scene.image} sizes={fullBleed} />
              </Scrub>
            </Scrub>
            {scene.caption && (
              <p className="absolute start-layout end-layout bottom-u6 max-w-[37.5rem] bg-(--t-bg) p-u2 text-lead desk:end-auto">
                <Localized text={scene.caption} />
              </p>
            )}
          </SceneLayer>
        </Scene>
      ))}
    </>
  );
}
