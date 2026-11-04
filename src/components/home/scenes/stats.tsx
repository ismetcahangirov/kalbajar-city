import { getLocale, getTranslations } from "next-intl/server";

import { Scene, SceneLayer } from "@/components/motion/scene";
import { Scrub } from "@/components/motion/scrub";
import { StatSwap, type StatSet } from "@/components/motion/stat-swap";
import { defaultImage } from "@/content/defaults";
import { formatNumber, unitSymbol } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { HomeSection, HomeStat } from "@/lib/public/home";

import { Localized } from "../localized";
import { fullBleed, Photo } from "./photo";

type StatsProps = Extract<HomeSection, { kind: "stats" }>;

/** A19: from a point at the centre to the full screen. */
const iris = {
  point: "inset(50svh 50% calc(100% - 50svh) 50%)",
  open: "inset(0 0 calc(100% - 100svh) 0)",
};

/**
 * S5 middle (pyzhevsky-home.md §3): an iris opens onto the interior
 * (`home.stats.background`, A19) while the photo drifts up inside it, and
 * the facts swap set after set at the screen's edges (A30, A31). Our facts
 * are single numbers, not ranges, so each set pairs two of them, one per
 * edge, each with its label above it. The numbers sit on a solid band: the
 * photo is too light under them for AA. Stacked (phones, reduced motion, no
 * script) every set is its own row over the open photo.
 */
export async function Stats({ items }: StatsProps) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Home.stats");

  const value = (item: HomeStat) => {
    const number = formatNumber(item.value, locale, {
      maximumFractionDigits: item.unit === "ha" ? 2 : 0,
    });
    return item.unit ? `${number} ${unitSymbol(item.unit, locale)}` : number;
  };
  const sets: StatSet[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const [left, right] = [items[i]!, items[i + 1]];
    sets.push({
      key: left.fact,
      fromLabel: <Localized text={left.label} />,
      from: <span data-stat-value="">{value(left)}</span>,
      // The set's number: the sets' own labels sit over their figures.
      label: formatNumber(i / 2 + 1, locale, { minimumIntegerDigits: 2, useGrouping: false }),
      toLabel: right ? <Localized text={right.label} /> : undefined,
      to: right ? <span data-stat-value="">{value(right)}</span> : "",
    });
  }
  const length = 2 + sets.length;

  return (
    <Scene theme="dark" length={length} underPrevious aria-label={t("label")}>
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
            range={`0-0 → -${(length - 1) * 100}-0`}
            from={{ translate: "0 0%" }}
            to={{ translate: "0 -23%" }}
            className="h-[130%]"
          >
            <Photo image={defaultImage("home.stats.background", locale)} sizes={fullBleed} />
          </Scrub>
        </Scrub>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full bg-(--t-bg) px-layout py-u3">
            <StatSwap
              trigger="scene"
              at={sets.map((_, i) => `-${(i + 1) * 100}%`)}
              sets={sets}
              className="w-full"
            />
          </div>
        </div>
      </SceneLayer>
    </Scene>
  );
}
