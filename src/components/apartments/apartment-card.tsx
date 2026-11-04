import { useTranslations } from "next-intl";

import { formatArea, formatNumber, formatPrice } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import type { PublicApartment } from "@/shared/apartments";

type Props = {
  apartment: PublicApartment;
  locale: Locale;
  /** Whether the owner shows prices; without them the price line is left out. */
  pricesVisible: boolean;
};

/**
 * The list view (`gorunus=siyahi`): one compact hairline row per apartment
 * on the catalogue's dark theme, the status as a word. The cards are
 * `FlatCard` from `@/components/ui`.
 */
export function ApartmentRow({ apartment, locale, pricesVisible }: Props) {
  const names = useTranslations("Apartments");
  const t = useTranslations("Catalogue");
  const status = useTranslations("Status");
  const specs = [
    t("card.rooms", { rooms: apartment.rooms }),
    formatArea(Number(apartment.areaTotal), locale),
    t("card.floor", { floor: formatNumber(apartment.floor, locale) }),
  ].join(" · ");
  return (
    <li className="relative flex flex-wrap items-center gap-x-u2 gap-y-u border-b border-(--t-line) py-u">
      <h3 className="min-w-0 grow basis-full text-body sm:basis-auto">
        <Link
          href={{ pathname: "/menziller/[slug]", params: { slug: apartment.slug } }}
          className={cx(
            "underline-offset-4 hover:underline",
            "after:absolute after:inset-0 focus-visible:outline-none",
            "focus-visible:after:outline-(length:--focus-ring-width) focus-visible:after:outline-(--t-text) focus-visible:after:outline-solid",
          )}
        >
          {names("name", { block: apartment.block.name.value, number: apartment.number })}
        </Link>
      </h3>
      <span className="text-small-t text-(--t-small)">{specs}</span>
      {pricesVisible && apartment.status !== "sold" && (
        <span className="text-body">
          {apartment.price
            ? formatPrice(apartment.price.amount, apartment.price.currency, locale)
            : t("priceOnRequest")}
        </span>
      )}
      <span className="text-label-xs uppercase">{status(apartment.status)}</span>
    </li>
  );
}
