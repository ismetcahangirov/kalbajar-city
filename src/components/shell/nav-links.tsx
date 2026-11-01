"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

import { underlineLinkClass } from "./link-class";
import { isCurrent, type NavItem } from "./navigation";

type NavLinksProps = {
  items: NavItem[];
  /** `bar` is the header row; `menu` the large stacked list of the mobile menu. */
  variant: "bar" | "menu";
  className?: string;
};

/** The primary navigation, marking the current page with `aria-current`. */
export function NavLinks({ items, variant, className }: NavLinksProps) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className={className}>
      <ul className={variant === "bar" ? "flex items-center gap-6 xl:gap-8" : "flex flex-col"}>
        {items.map(({ key, href }) => (
          <li key={key}>
            <Link
              href={href}
              aria-current={isCurrent(pathname, href) ? "page" : undefined}
              className={underlineLinkClass(
                cx(
                  "whitespace-nowrap",
                  variant === "bar" ? "text-body" : "py-1 text-heading after:bottom-1",
                ),
              )}
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
