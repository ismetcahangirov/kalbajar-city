import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import { Localized } from "@/components/home/localized";
import { Scene, SceneLayer } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { Picture } from "@/components/ui/picture";
import type { Localized as LocalizedValue } from "@/i18n/content";
import type { PublicImage } from "@/lib/public/media";

export type Screen = { id: string; image: PublicImage; caption: LocalizedValue | null };

const shut = "inset(100% 0% 0% 0%)";
const open = "inset(0% 0% 0% 0%)";

/**
 * The reference's sticky screen slider (`/spaces`): one full-bleed image per
 * screen, pinned, each next one wiping up over the one before (`clip-up`
 * scrubbed through its viewport of scroll), its caption centred, and a
 * vertical strip of thumbnails at the right edge that jumps to each screen.
 *
 * Every screen has an anchor one viewport below the last, so the strip's
 * links land on the right screen whether the scene pins or not. Stacked
 * (touch, under 668 px, reduced motion, no script) it is a column of
 * full-screen images and the strip is hidden (src/styles/content.css).
 */
export async function ScreenSlider({
  id,
  title,
  screens,
}: {
  id: string;
  title: string;
  screens: Screen[];
}) {
  const t = await getTranslations("Gallery");
  return (
    <Scene
      id={id}
      theme="dark"
      length={screens.length}
      aria-labelledby={`${id}-basliq`}
      data-screen-slider=""
    >
      <h2 id={`${id}-basliq`} className="sr-only">
        {title}
      </h2>
      {screens.map((screen, i) => {
        const figure = (
          <figure className="relative size-full">
            <Picture image={screen.image} sizes="100vw" />
            {screen.caption && (
              <figcaption className="absolute inset-x-0 bottom-u6 flex justify-center px-layout desk:top-0 desk:bottom-0 desk:items-center">
                {/* A dark label box, not a scrim over the photo: the text keeps its contrast. */}
                <span className="max-w-[30rem] bg-(--t-bg) px-u2 py-u text-center text-lead">
                  <Localized text={screen.caption} />
                </span>
              </figcaption>
            )}
          </figure>
        );
        return (
          <SceneLayer key={screen.id}>
            {i === 0 ? (
              figure
            ) : (
              <Scrub
                trigger="scene"
                range={`${-100 * (i - 1)}-0 → ${-100 * i}-0`}
                from={{ clipPath: shut }}
                to={{ clipPath: open }}
                className="size-full"
              >
                {figure}
              </Scrub>
            )}
          </SceneLayer>
        );
      })}
      {screens.map((screen, i) => (
        <span
          key={screen.id}
          id={`${id}-${i + 1}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 h-px"
          style={{ top: `calc(${i} * 100svh)` } as CSSProperties}
        />
      ))}
      <SceneLayer stacked="auto" className="pointer-events-none">
        <nav
          aria-label={title}
          data-screen-strip=""
          className="pointer-events-auto absolute end-layout top-1/2 -translate-y-1/2 flex-col gap-u"
        >
          {screens.map((screen, i) => (
            <a
              key={screen.id}
              href={`#${id}-${i + 1}`}
              aria-label={t("screen", { index: String(i + 1) })}
              className="relative block h-10 w-15 overflow-hidden outline-offset-2 hover:outline hover:outline-1 hover:outline-(--t-text)"
            >
              <Picture image={{ ...screen.image, alt: "", illustrative: false }} sizes="60px" />
            </a>
          ))}
        </nav>
      </SceneLayer>
    </Scene>
  );
}
