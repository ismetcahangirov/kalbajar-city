import { getTranslations } from "next-intl/server";

import { GridLines } from "@/components/motion/grid-lines";
import { Scene, SceneLayer } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { SplitWord } from "@/components/motion/split-word";
import { Threshold } from "@/components/motion/threshold";
import { underlineLinkClass } from "@/components/shell/underline-link";
import { defaultImage, type DefaultSlot } from "@/content/defaults";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import type { HomeSection } from "@/lib/public/home";

import { LocationCard } from "./location-card";
import { Localized } from "../localized";
import { fullBleed, langOf, Photo } from "./photo";

type LocationProps = Extract<HomeSection, { kind: "location" }> & { locale: Locale };

const cardSlots = [1, 2, 3, 4, 5, 6].map((n) => `home.location.card.${n}` as DefaultSlot);

/** The giant word at a scene's foot; every scene has its own copy in its own colour (A17). */
function Word({ word, locale }: { word: string; locale: Locale }) {
  return (
    <SplitWord
      word={word}
      lang={locale}
      className="px-layout pb-u2 text-word text-(--t-primary) uppercase"
    />
  );
}

/**
 * The "MƏKAN" stack, S3 (pyzhevsky-home.md §3): the intro photo with the
 * title and paragraph; the sand layer with the two images moving in
 * opposite directions (A26); the travel times as rows of `LocationCard`s
 * wiping open from the bottom (A29), sand then taupe; then the map when the
 * console has one. Each part keeps the word at its foot in its own colour,
 * so as one scene slides over the other the word recolours at the edge
 * (A17). Text over the photo sits on its own surface.
 */
export async function Location({ title, body, map, distances, locale }: LocationProps) {
  const t = await getTranslations("Home");
  const word = t("words.location");
  const rows: Array<typeof distances> = [];
  for (let i = 0; i < distances.length; i += 3) rows.push(distances.slice(i, i + 3));

  return (
    <>
      <Scene theme="dark" length={2} aria-labelledby="yerlesme">
        <SceneLayer className="isolate flex flex-col">
          <div className="absolute inset-0 -z-2">
            <Scrub
              trigger="scene"
              range="100-0 → 0-100"
              from={{ translate: "0 -8%" }}
              to={{ translate: "0 8%" }}
              className="absolute inset-x-0 -inset-y-[10%]"
            >
              <Photo image={defaultImage("home.location.intro", locale)} sizes={fullBleed} />
            </Scrub>
          </div>
          <GridLines variant="thirds" alt />
          <div className="flex flex-1 items-end justify-center px-layout pb-u6">
            <div className="flex max-w-[30rem] flex-col items-center gap-u2 bg-(--t-bg) p-u2 text-center">
              <h2
                id="yerlesme"
                lang={langOf(title)}
                className="text-title text-(--t-heading) uppercase"
              >
                {title.value}
              </h2>
              {body && (
                <p className="text-body">
                  <Localized text={body} />
                </p>
              )}
            </div>
          </div>
          <Word word={word} locale={locale} />
        </SceneLayer>
      </Scene>

      <Scene theme="sand" length={2} as="div">
        <SceneLayer className="isolate flex flex-col">
          <GridLines variant="thirds" />
          <div className="grid flex-1 grid-cols-2 items-center gap-u px-layout pt-u12 desk:grid-cols-3 desk:gap-u2">
            <Scrub
              trigger="scene"
              range="100-0 → 0-100"
              from={{ translate: "0 -50svh" }}
              to={{ translate: "0 50svh" }}
              className="relative aspect-[440/524]"
            >
              <Photo
                image={defaultImage("home.location.moverLeft", locale)}
                sizes="(width >= 41.75rem) 31vw, 46vw"
              />
            </Scrub>
            <Scrub
              trigger="scene"
              range="100-0 → 0-0"
              from={{ translate: "0 100%" }}
              to={{ translate: "0 0%" }}
              className="relative aspect-[440/524] desk:col-start-3"
            >
              <Photo
                image={defaultImage("home.location.moverRight", locale)}
                sizes="(width >= 41.75rem) 31vw, 46vw"
              />
            </Scrub>
          </div>
          <Word word={word} locale={locale} />
        </SceneLayer>
      </Scene>

      {rows.map((row, r) => (
        <section
          key={r}
          data-theme={r % 2 === 0 ? "sand" : "dark-alt"}
          aria-label={r === 0 ? t("location.cards") : undefined}
          className="relative isolate flex flex-col justify-between gap-u6 bg-(--t-bg) pt-u12 text-(--t-text) desk:min-h-svh desk:pt-u6"
        >
          <GridLines variant="thirds" alt={r % 2 === 1} />
          <div className="flex flex-col gap-u6 px-layout">
            {r === 0 && (
              <p className="text-center text-label text-(--t-small) uppercase">
                {t("location.cards")}
              </p>
            )}
            <Threshold
              at="80-0"
              className={cx(
                "group grid desk:grid-cols-3 desk:gap-u2",
                r === 0 ? "desk:mt-u6" : "desk:mt-u12",
              )}
            >
              {row.map((distance, i) => (
                <div
                  key={distance.place.value}
                  className="transition-[clip-path] duration-(--duration-reveal) ease-(--ease-wipe) group-data-[state=out]:duration-(--duration-slow) group-data-[state=out]:[clip-path:inset(100%_0_0_0)]"
                >
                  <LocationCard
                    image={defaultImage(cardSlots[(r * 3 + i) % cardSlots.length]!, locale)}
                    place={distance.place}
                    minutes={distance.minutes}
                    unit={t("location.unit")}
                    locale={locale}
                  />
                </div>
              ))}
            </Threshold>
          </div>
          <div className="flex flex-col gap-u3">
            {r === rows.length - 1 && !map && (
              <div className="px-layout">
                <Link href="/yerlesme" className={underlineLinkClass("text-label uppercase")}>
                  {t("location.more")}
                </Link>
              </div>
            )}
            <Word word={word} locale={locale} />
          </div>
        </section>
      ))}

      {(map || rows.length === 0) && (
        <section
          data-theme="light"
          className="flex flex-col gap-u3 bg-(--t-bg) px-layout py-u6 text-(--t-text)"
        >
          {map && (
            <div className="relative aspect-[16/9] w-full">
              <Photo image={map} sizes={fullBleed} />
            </div>
          )}
          <div>
            <Link href="/yerlesme" className={underlineLinkClass("text-label uppercase")}>
              {t("location.more")}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
