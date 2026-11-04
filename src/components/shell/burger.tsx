import { useTranslations } from "next-intl";

import { cx } from "@/lib/cx";

/**
 * The menu button (ui-kit.md → Burger): two 1 px lines 60 px wide, 3 px
 * apart, in a 44 px hit area, with the conveyor hover (A38). It opens the
 * menu through `ShellDialogs`; no script of its own.
 */
export function Burger({ className }: { className?: string }) {
  const t = useTranslations("Shell");
  return (
    <button
      type="button"
      data-dialog-open="site-menu"
      aria-haspopup="dialog"
      aria-controls="site-menu"
      aria-expanded="false"
      aria-label={t("openMenu")}
      className={cx("burger", className)}
    >
      <span aria-hidden="true" className="burger__line">
        <span />
      </span>
      <span aria-hidden="true" className="burger__line">
        <span />
      </span>
    </button>
  );
}
