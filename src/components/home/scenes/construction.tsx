import { getFormatter, getTranslations } from "next-intl/server";
import { Fragment } from "react";

import { GridLines } from "@/components/motion/grid-lines";
import { Scene, SceneLayer } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { SplitWord } from "@/components/motion/split-word";
import { underlineLinkClass } from "@/components/shell/underline-link";
import { formatPercent } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import type { HomeSection } from "@/lib/public/home";

import { Localized } from "../localized";
import { fullBleed, Photo } from "./photo";

type ConstructionProps = Extract<HomeSection, { kind: "construction" }> & { locale: Locale };

/**
 * S9 (pyzhevsky-home.md §3): the latest construction photo pinned with a
 * slow drift (A27) and the giant word climbing out of its clip at the top
 * (A16); over it, text blocks alternate sides (A40): the progress as a
 * numeral, the update and its month, the link to every update. Each block
 * fades as it passes the upper half and the last two rise into place. The
 * blocks are solid surfaces over the photo. On phones the photo is not
 * pinned and the blocks follow it.
 */
export async function Construction({ title, update, locale }: ConstructionProps) {
  const t = await getTranslations("Home");
  const format = await getFormatter();
  const month = format.dateTime(new Date(`${update.month}T00:00:00Z`), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const percent = formatPercent(update.progress, locale);
  const blocks = [
    <Fragment key="progress">
      <p aria-hidden="true" className="text-numeral text-(--t-primary)">
        {percent}
      </p>
      <p className="text-lead">{t("construction.progress", { percent })}</p>
    </Fragment>,
    <Fragment key="update">
      <p className="text-label text-(--t-small) uppercase">{t("construction.asOf", { month })}</p>
      <h3 className="text-lead">
        <Localized text={update.title} />
      </h3>
    </Fragment>,
    <Link key="more" href="/tikinti" className={underlineLinkClass("text-label uppercase")}>
      {t("construction.more")}
    </Link>,
  ];

  return (
    <Scene theme="dark" length={2} aria-labelledby="tikinti">
      <SceneLayer className="isolate">
        <div className="absolute inset-0 -z-2 overflow-hidden">
          <Scrub
            trigger="scene"
            range="100-0 → 0-100"
            from={{ translate: "0 0%" }}
            to={{ translate: "0 -16.67%" }}
            className="h-[120%]"
          >
            <Photo image={update.image} sizes={fullBleed} />
          </Scrub>
        </div>
        <GridLines variant="half" alt draw trigger="scene" />
        <h2 id="tikinti" className="sr-only">
          {title.value}
        </h2>
        <SplitWord
          word={t("words.construction")}
          mode="staircase"
          trigger="scene"
          lang={locale}
          className="px-layout pt-u12 text-word text-(--t-primary) uppercase desk:pt-u6"
        />
      </SceneLayer>
      <div className="relative flex flex-col gap-u3 px-layout py-u4 pinned:gap-[40svh] pinned:pt-[100svh] pinned:pb-[30svh]">
        {blocks.map((block, i) => (
          <Scrub
            key={i}
            range="50-0 → 25-0"
            from={{ opacity: 1 }}
            to={{ opacity: 0 }}
            className={cx("desk:w-5/12", i % 2 === 1 && "desk:ms-[58.33%]")}
          >
            <Scrub
              range="100-0 → 50-0"
              from={{ translate: i > 0 ? "0 20svh" : "0 0svh" }}
              to={{ translate: "0 0svh" }}
              className="flex flex-col items-start gap-u2 bg-(--t-bg) p-u2"
            >
              {block}
            </Scrub>
          </Scrub>
        ))}
      </div>
    </Scene>
  );
}
