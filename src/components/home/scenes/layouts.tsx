import { getLocale, getTranslations } from "next-intl/server";

import { GridLines } from "@/components/motion/grid-lines";
import { underlineLinkClass } from "@/components/shell/underline-link";
import { formatArea, formatNumber } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { HomeSection } from "@/lib/public/home";

import { CircleToggle } from "./circle-sign";
import { HoverListToggle } from "./hover-list-toggle";
import { Localized } from "../localized";
import { Photo } from "./photo";

type LayoutsProps = Extract<HomeSection, { kind: "layouts" }>;

/**
 * S5's list (pyzhevsky-home.md §3) as a `HoverList` (ui-kit.md →
 * Components): the layout groups as rows of `--text-lead-lg` on the right
 * half, each a link to the catalogue filtered by its room count; with a
 * mouse the hovered row's caption (its area range and plan count) swaps in
 * over the photo on the left (A33). On touch the rows are a one-open
 * accordion under the photo. The captions sit on a solid surface: the
 * default photo is too light for AA under text.
 */
export async function Layouts({ title, body, groups, background }: LayoutsProps) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Home.layouts");
  const range = (min: number, max: number) =>
    min === max
      ? formatArea(min, locale)
      : `${formatNumber(min, locale, { maximumFractionDigits: 2 })}–${formatArea(max, locale)}`;

  return (
    <section
      data-theme="dark"
      aria-labelledby="planlar"
      className="relative isolate bg-(--t-bg) text-(--t-text) desk:grid desk:min-h-svh desk:grid-cols-2"
    >
      <GridLines variant="half" alt />
      <div className="relative aspect-[4/3] desk:aspect-auto">
        <Photo image={background} sizes="(width >= 41.75rem) 50vw, 100vw" />
      </div>
      <div className="flex flex-col justify-center gap-u4 py-u6 desk:py-u12">
        <h2 id="planlar" className="px-layout text-label text-(--t-small) uppercase">
          {title.value}
        </h2>
        {body && (
          <p className="max-w-(--container-prose) px-layout text-body">
            <Localized text={body} />
          </p>
        )}
        <ul data-hover-list="" className="border-b border-(--t-line-alt)">
          {groups.map((group, i) => {
            const name = t("rooms", { rooms: formatNumber(group.rooms, locale) });
            const captionId = `planlar-${group.rooms}`;
            return (
              <li
                key={group.rooms}
                data-hover-row=""
                data-open={i === 0 ? "" : undefined}
                className="border-t border-(--t-line-alt)"
              >
                <div className="flex items-center gap-u pe-layout">
                  <Link
                    href={{ pathname: "/menziller", query: { otaq: String(group.rooms) } }}
                    data-hover-link=""
                    aria-describedby={captionId}
                    className="relative flex min-h-target flex-1 items-center gap-u2 px-layout py-u3 text-lead-lg desk:py-[3.125rem]"
                  >
                    <span className="trim-cap">{name}</span>
                    <span className="hidden pointer-desk:flex">
                      <CircleToggle />
                    </span>
                  </Link>
                  <HoverListToggle
                    controls={captionId}
                    label={t("details", { title: name })}
                    initiallyOpen={i === 0}
                  />
                </div>
                <p
                  id={captionId}
                  data-hover-caption=""
                  className="px-layout pb-u3 text-body pointer-desk:pointer-events-none pointer-desk:absolute pointer-desk:inset-y-0 pointer-desk:start-0 pointer-desk:flex pointer-desk:w-1/2 pointer-desk:items-center pointer-desk:justify-center pointer-desk:p-0"
                >
                  <span className="pointer-desk:bg-(--t-bg) pointer-desk:p-u2">
                    {`${range(group.areaMin, group.areaMax)} · ${t("plans", { count: group.plans })}`}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
        <div className="px-layout">
          <Link href="/menziller" className={underlineLinkClass("text-label uppercase")}>
            {t("all")}
          </Link>
        </div>
      </div>
    </section>
  );
}
