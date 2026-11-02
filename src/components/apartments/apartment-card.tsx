import { useTranslations } from "next-intl";

import { Card, Picture } from "@/components/ui";
import { formatArea, formatNumber, formatPrice } from "@/i18n/format";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import type { PublicApartment } from "@/shared/apartments";

import { StatusBadge } from "./status-badge";

type Props = {
  apartment: PublicApartment;
  locale: Locale;
  /** Whether the owner shows prices; without them the price line is left out. */
  pricesVisible: boolean;
  titleAs?: "h2" | "h3";
};

/** The apartment's name: `A blok, mənzil 101`. Door numbers repeat across blocks. */
export function useApartmentName() {
  const t = useTranslations("Apartments");
  return (apartment: Pick<PublicApartment, "number" | "block">) =>
    t("name", { block: apartment.block.name.value, number: apartment.number });
}

function usePriceLabel(locale: Locale) {
  const t = useTranslations("Catalogue");
  return (apartment: PublicApartment) =>
    apartment.price
      ? formatPrice(apartment.price.amount, apartment.price.currency, locale)
      : t("priceOnRequest");
}

function useSpecs(locale: Locale) {
  const t = useTranslations("Catalogue.card");
  return (apartment: PublicApartment) =>
    [
      t("rooms", { rooms: apartment.rooms }),
      formatArea(Number(apartment.areaTotal), locale),
      t("floor", { floor: formatNumber(apartment.floor, locale) }),
    ].join(" · ");
}

/** A catalogue card: the plan (or the door number), name, specs and status. */
export function ApartmentCard({ apartment, locale, pricesVisible, titleAs = "h3" }: Props) {
  const name = useApartmentName();
  const specs = useSpecs(locale);
  const price = usePriceLabel(locale);
  return (
    <Card
      title={name(apartment)}
      titleAs={titleAs}
      href={getPathname({
        href: { pathname: "/menziller/[slug]", params: { slug: apartment.slug } },
        locale,
      })}
      chips={<StatusBadge status={apartment.status} />}
      meta={
        <>
          <p>{specs(apartment)}</p>
          {pricesVisible && apartment.status !== "sold" && (
            <p className="mt-1 text-body text-text">{price(apartment)}</p>
          )}
        </>
      }
      media={
        apartment.plan ? (
          <div className="size-full bg-surface-raised p-4 [&_img]:object-contain!">
            <Picture
              image={apartment.plan}
              sizes="(min-width: 80rem) 22vw, (min-width: 40rem) 45vw, 100vw"
            />
          </div>
        ) : (
          <span aria-hidden className="flex size-full items-end p-6 text-stat text-text-muted">
            {apartment.number}
          </span>
        )
      }
    />
  );
}

/** The list view: one compact row per apartment. */
export function ApartmentRow({ apartment, locale, pricesVisible }: Props) {
  const name = useApartmentName();
  const specs = useSpecs(locale);
  const price = usePriceLabel(locale);
  return (
    <li className="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border py-4">
      <h3 className="min-w-0 grow basis-full text-title sm:basis-auto">
        <Link
          href={{ pathname: "/menziller/[slug]", params: { slug: apartment.slug } }}
          className={cx(
            "underline-offset-4 hover:underline",
            "after:absolute after:inset-0 focus-visible:outline-none",
            "focus-visible:after:outline-(length:--focus-ring-width) focus-visible:after:outline-offset-(--focus-ring-offset) focus-visible:after:outline-focus focus-visible:after:outline-solid",
          )}
        >
          {name(apartment)}
        </Link>
      </h3>
      <span className="text-small text-text-muted">{specs(apartment)}</span>
      {pricesVisible && apartment.status !== "sold" && (
        <span className="text-body">{price(apartment)}</span>
      )}
      <StatusBadge status={apartment.status} />
    </li>
  );
}
