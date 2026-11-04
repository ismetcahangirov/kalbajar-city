import type { Localized as LocalizedValue } from "@/i18n/content";
import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { PublicImage } from "@/lib/public/media";

import { Localized } from "../localized";
import { Photo } from "./photo";

type LocationCardProps = {
  image: PublicImage;
  place: LocalizedValue;
  minutes: number;
  /** "DƏQ", from the catalogue. */
  unit: string;
  locale: Locale;
};

/**
 * A travel time (ui-kit.md → LocationCard): from 668 px a 440 × 240 card,
 * the image over a 65 px strip with the round minutes badge, "DƏQ" and the
 * place; on phones a row with the place and minutes on the left and the
 * image on the right (pyzhevsky-home.md §5).
 */
export function LocationCard({ image, place, minutes, unit, locale }: LocationCardProps) {
  return (
    <figure className="flex items-stretch gap-u border-t border-(--t-line-alt) py-u desk:aspect-[440/240] desk:flex-col desk:gap-0 desk:border-t-0 desk:p-0">
      <div className="relative order-2 aspect-[180/106] w-[46%] shrink-0 desk:order-1 desk:aspect-auto desk:w-full desk:flex-1">
        <Photo image={image} sizes="(width >= 41.75rem) 31vw, 46vw" />
      </div>
      <figcaption className="order-1 flex flex-1 flex-col justify-between gap-u text-body desk:order-2 desk:h-[4.0625rem] desk:flex-none desk:flex-row desk:items-center desk:bg-(--color-ink) desk:px-u desk:text-(--color-cream)">
        <span className="flex items-center gap-u">
          <span className="flex h-[1.5625rem] min-w-[1.5625rem] shrink-0 items-center justify-center rounded-full bg-(--color-cream) px-[0.4em] text-label-xs text-(--color-ink)">
            {formatNumber(minutes, locale)}
          </span>
          <span className="text-label uppercase">{unit}</span>
        </span>
        <span className="desk:text-end">
          <Localized text={place} />
        </span>
      </figcaption>
    </figure>
  );
}
