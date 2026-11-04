import { getTranslations } from "next-intl/server";

import { Reveal } from "@/components/motion/reveal";
import { SplitWord } from "@/components/motion/split-word";
import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { HomeSection } from "@/lib/public/home";

import { Localized } from "../localized";
import { langOf } from "./photo";

type ProcessProps = Extract<HomeSection, { kind: "process" }> & { locale: Locale };

/**
 * S8 (pyzhevsky-home.md §3) on taupe: the giant word climbs out of its clip
 * letter by letter (A16, on phones too), the title as a centred lead, then
 * the steps as columns whose dividers wipe in from the top as a group
 * (A39). On phones the columns are a native horizontal scroller.
 */
export async function Process({ title, steps, locale }: ProcessProps) {
  const t = await getTranslations("Home.words");
  return (
    <section
      data-theme="dark-alt"
      aria-labelledby="addimlar"
      className="relative isolate overflow-hidden bg-(--t-bg) pt-u12 text-(--t-text) desk:pt-u6"
    >
      <SplitWord
        word={t("process")}
        mode="staircase"
        mobile
        lang={locale}
        className="px-layout text-word text-(--t-primary) uppercase"
      />
      <h2
        id="addimlar"
        lang={langOf(title)}
        className="mx-auto trim-cap max-w-[38rem] px-layout py-u12 text-center text-lead text-(--t-text) desk:text-(--t-heading)"
      >
        {title.value}
      </h2>
      {/* Focusable, so the steps scroll from the keyboard on phones. */}
      <div
        tabIndex={0}
        className="snap-x snap-mandatory overflow-x-auto desk:snap-none desk:overflow-visible"
      >
        <Reveal
          kind="clip-down"
          group
          as="ol"
          className="flex desk:grid desk:auto-cols-fr desk:grid-flow-col"
        >
          {steps.map((step, i) => (
            <li
              key={step.title.value}
              className="flex w-[80vw] shrink-0 snap-start flex-col gap-u6 border-s border-(--t-line-alt) px-layout pt-u2 pb-u12 first:border-s-0 desk:w-auto desk:gap-u6"
            >
              <h3 className="text-label uppercase">
                {formatNumber(i + 1, locale, { minimumIntegerDigits: 2, useGrouping: false })}
                {" · "}
                <Localized text={step.title} />
              </h3>
              <p className="text-body">
                <Localized text={step.body} />
              </p>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
