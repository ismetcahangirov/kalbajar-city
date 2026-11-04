import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

/**
 * The typeset name in the header and the menu, linking home. Replaced by the
 * vector logo when the owner supplies it (#7).
 */
export function BrandLink({ className }: { className?: string }) {
  const t = useTranslations("Shell");
  return (
    <Link
      href="/"
      aria-label={t("home")}
      className={cx(
        "inline-flex min-h-target shrink-0 items-center text-legacy-title font-normal whitespace-nowrap",
        className,
      )}
    >
      {t("brand")}
    </Link>
  );
}

/**
 * "Kalbajar City" at the `wordmark` size, which fits the name to the page
 * width (docs/ui-kit.md). Decorative: the name is already on the page.
 */
export function Wordmark({ className }: { className?: string }) {
  const t = useTranslations("Shell");
  return (
    // The wrapper is the container that `100cqi` in the token measures.
    <div aria-hidden="true" className={cx("@container", className)}>
      {/* Bottom padding in the wordmark's own em keeps the j and y descenders
          inside the footer: the line height (0.9) is shorter than the glyphs. */}
      <p className="pb-[0.22em] text-wordmark whitespace-nowrap text-accent select-none">
        {t("brand")}
      </p>
    </div>
  );
}
