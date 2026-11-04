import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { formatNumber, formatPrice, formatPricePerArea, unitSymbol } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import type { PublicApartment, PublicApartmentStatus } from "@/shared/apartments";

import { CircledArrow } from "./arrow-block";
import { Picture } from "./picture";

/** Status words in their colour on cream; the word always carries the meaning. */
const statusClass: Record<PublicApartmentStatus, string> = {
  available: "text-status-available",
  reserved: "text-status-reserved",
  sold: "text-status-sold",
};

type FlatCardProps = {
  apartment: PublicApartment;
  locale: Locale;
  /** Whether the owner shows prices; without them the price is left out. */
  pricesVisible: boolean;
  titleAs?: "h2" | "h3";
  className?: string;
};

/**
 * An apartment in the catalogue (ui-kit.md → FlatCard): a cream card with
 * "2 OTAQ │ 83,99 m²", the number, floor and block with the price and the
 * price per m², the status word, the plan, and the layout. The whole card is
 * one link; its title also names the apartment for screen readers. Hover
 * grows the cream ground under still content. A reserved apartment's plan is
 * dimmed under a lock; a sold one shows no price.
 */
export function FlatCard({
  apartment,
  locale,
  pricesVisible,
  titleAs: Title = "h3",
  className,
}: FlatCardProps) {
  const t = useTranslations("Catalogue");
  const names = useTranslations("Apartments");
  const status = useTranslations("Status");
  const area = Number(apartment.areaTotal);
  const name = names("name", { block: apartment.block.name.value, number: apartment.number });
  const showPrice = pricesVisible && apartment.status !== "sold";
  const reserved = apartment.status === "reserved";

  return (
    <article
      data-theme="light"
      className={cx(
        "flat-card relative isolate flex h-full flex-col p-5 text-(--t-text)",
        className,
      )}
    >
      <Title className="flex items-baseline gap-u text-lead tracking-[0.1em] text-(--t-text) uppercase lg:text-(--t-heading)">
        <Link
          href={{ pathname: "/menziller/[slug]", params: { slug: apartment.slug } }}
          className={cx(
            // Russian runs longest: the area may drop to a second line.
            "flex min-w-0 flex-wrap items-baseline gap-x-u",
            // The link covers the card; its ring draws inside the card's edge.
            "after:absolute after:inset-0 focus-visible:outline-none",
            "focus-visible:after:outline-(length:--focus-ring-width) focus-visible:after:-outline-offset-4 focus-visible:after:outline-(--t-text) focus-visible:after:outline-solid",
          )}
        >
          <span>{t("card.rooms", { rooms: apartment.rooms })}</span>
          <span aria-hidden className="h-[0.7em] w-px self-center bg-(--t-line-alt)" />
          <span className="sr-only">, </span>
          <span>
            {formatNumber(area, locale, { maximumFractionDigits: 2 })}
            <sup className="ms-1 align-super text-label-xs normal-case">
              {unitSymbol("m2", locale)}
            </sup>
          </span>
          <span className="sr-only">, {name}</span>
        </Link>
      </Title>

      <div className="mt-u4 flex items-end justify-between gap-u border-b border-(--t-line) pb-u">
        <ul className="flex flex-col text-small-t">
          <li>{t("card.number", { number: apartment.number })}</li>
          <li>{t("card.floor", { floor: formatNumber(apartment.floor, locale) })}</li>
          <li>{apartment.block.name.value}</li>
        </ul>
        {showPrice && (
          <p className="flex flex-col items-end text-end">
            {apartment.price ? (
              <>
                <span className="text-body">
                  {formatPrice(apartment.price.amount, apartment.price.currency, locale)}
                </span>
                <span className="text-small-t">
                  {formatPricePerArea(
                    apartment.price.amount,
                    apartment.price.currency,
                    area,
                    locale,
                  )}
                </span>
              </>
            ) : (
              <span className="text-small-t">{t("priceOnRequest")}</span>
            )}
          </p>
        )}
      </div>

      <p className={cx("mt-u text-label-xs uppercase", statusClass[apartment.status])}>
        {status(apartment.status)}
      </p>

      <div className="relative mx-auto mt-u2 aspect-[280/240] w-4/5 desk:w-[70%]">
        <div className={cx("size-full", reserved && "opacity-50")}>
          {apartment.plan ? (
            <Picture
              image={apartment.plan}
              fit="contain"
              sizes="(min-width: 64rem) 22vw, (min-width: 41.75rem) 35vw, 80vw"
            />
          ) : (
            // No plan yet: the door number, decoration only (sand on cream).
            <span
              aria-hidden
              className="grid size-full place-items-center text-numeral text-(--t-secondary)"
            >
              {apartment.number}
            </span>
          )}
        </div>
        {reserved && (
          <Lock
            aria-hidden
            focusable={false}
            width={40}
            height={40}
            strokeWidth={1}
            className="absolute inset-0 m-auto text-(--t-control)"
          />
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-u pt-u2 text-label-xs uppercase">
        <span>{t("card.layout", { code: apartment.layout.code })}</span>
        <CircledArrow />
      </div>
    </article>
  );
}
