import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

/**
 * The typeset name, linking home: the header's and the menu's logo, until
 * the owner supplies the vector logo (#7). `large` is the footer's.
 */
export function BrandLink({
  className,
  large = false,
  ...rest
}: {
  className?: string;
  large?: boolean;
} & Record<`data-${string}`, string>) {
  const t = useTranslations("Shell");
  return (
    <Link
      href="/"
      aria-label={t("home")}
      data-nav-href="/"
      className={cx(
        "inline-flex min-h-target shrink-0 items-center whitespace-nowrap text-(--t-text) uppercase",
        large ? "text-logo-lg" : "text-logo",
        className,
      )}
      {...rest}
    >
      {t("brand")}
    </Link>
  );
}
