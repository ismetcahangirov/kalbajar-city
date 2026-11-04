import { GridLines } from "@/components/motion/grid-lines";
import { Reveal } from "@/components/motion/reveal";
import { Scene, SceneLayer } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { defaultImage } from "@/content/defaults";
import type { Locale } from "@/i18n/routing";
import type { HomeSection } from "@/lib/public/home";

import { Localized } from "../localized";
import { fullBleed, langOf, Photo } from "./photo";

type AboutProps = Extract<HomeSection, { kind: "about" }> & { locale: Locale };

/**
 * S1a and S1c (pyzhevsky-home.md §3). First the full-bleed `about` image
 * with the title as a lead that arrives line by line out of a blur (A11);
 * while the next part slides over it the pinned layer sinks at half speed
 * (A25). Then the cream card with the body scrolls over a pinned background
 * that scrolls through its frame (A22). Text over a photo sits on its own
 * surface, never straight on the image (the defaults are too light for AA).
 * Stacked, on phones and with reduced motion, it is the image, the title,
 * the background and the card one after another.
 */
export function About({ eyebrow, title, body, image, locale }: AboutProps) {
  return (
    <>
      <Scene theme="dark" length={3} underNext aria-labelledby="haqqinda">
        <SceneLayer className="isolate">
          <Scrub
            trigger="scene"
            range="-100-0 → -200-0"
            easing="quadOut"
            from={{ translate: "0 0svh" }}
            to={{ translate: "0 50svh" }}
            className="absolute inset-0 isolate"
          >
            <div className="absolute inset-0 -z-2">
              <Photo image={image} sizes={fullBleed} />
            </div>
            <GridLines variant="wider" alt draw trigger="scene" />
            <div className="absolute inset-x-0 top-u12 flex justify-center px-layout desk:top-u6">
              <div lang={langOf(title)} className="max-w-[37.5rem] bg-(--t-bg) p-u2 desk:p-u3">
                <Reveal
                  kind="text"
                  at="50-0"
                  trigger="scene"
                  as="h2"
                  id="haqqinda"
                  className="trim-cap text-center text-lead text-(--t-heading)"
                >
                  {title.value}
                </Reveal>
              </div>
            </div>
          </Scrub>
        </SceneLayer>
      </Scene>
      <Scene theme="light" length={2}>
        <SceneLayer data-theme="dark">
          <Scrub
            trigger="scene"
            range="0-0 → 100-100"
            from={{ translate: "0 calc(0svh - 0%)" }}
            to={{ translate: "0 calc(100svh - 100%)" }}
            className="h-[150svh]"
          >
            <Photo image={defaultImage("home.about.background", locale)} sizes={fullBleed} />
          </Scrub>
        </SceneLayer>
        <div className="relative px-layout py-u4 desk:grid desk:grid-cols-12 pinned:py-[50svh]">
          <article
            data-theme="light"
            className="flex flex-col justify-between gap-u6 bg-(--t-bg) p-u2 text-(--t-text) desk:col-span-5 desk:col-start-7 desk:min-h-[41.67vw]"
          >
            {eyebrow && (
              <p className="text-small-t">
                <Localized text={eyebrow} />
              </p>
            )}
            <p lang={langOf(body)} className="trim-cap text-lead">
              {body.value}
            </p>
          </article>
        </div>
      </Scene>
    </>
  );
}
