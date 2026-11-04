import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "link";
export type ButtonSize = "md" | "lg";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

type ButtonAsButton = Common & ComponentPropsWithoutRef<"button"> & { href?: undefined };
type ButtonAsLink = Common & ComponentPropsWithoutRef<"a"> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/** Class names for a button, for link components that cannot use `Button`. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  if (variant === "link") {
    return cx(
      "inline-flex min-h-target items-center gap-2 text-body font-medium text-text",
      "underline decoration-1 underline-offset-4",
      "aria-disabled:pointer-events-none aria-disabled:opacity-(--opacity-disabled)",
      className,
    );
  }
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full px-6 text-body font-medium",
    "transition-transform duration-(--duration-fast) ease-out active:scale-[0.98]",
    "aria-disabled:pointer-events-none aria-disabled:opacity-(--opacity-disabled)",
    "disabled:pointer-events-none disabled:opacity-(--opacity-disabled)",
    size === "lg" ? "min-h-control-lg px-8" : "min-h-control",
    variant === "primary"
      ? "bg-action text-action-text"
      : "border border-border-strong bg-transparent text-text hover:bg-surface-alt",
    className,
  );
}

/**
 * Pill button. Renders a link when given `href`: an internal path uses
 * next/link, anything with a scheme (tel:, https:, mailto:) a plain anchor.
 * Internal paths must already be localised: build them with `getPathname`
 * from `@/i18n/navigation`, never by concatenating strings.
 */
export function Button(props: ButtonProps) {
  const { variant, size, leadingIcon, trailingIcon, className, children, ...rest } = props;
  const classes = buttonClass({ variant, size, className });
  const content = (
    <>
      {leadingIcon}
      {children}
      {trailingIcon}
    </>
  );

  if (rest.href !== undefined) {
    const anchor = rest as ComponentPropsWithoutRef<"a"> & { href: string };
    if (/^[a-z][a-z0-9+.-]*:/i.test(anchor.href)) {
      return (
        <a className={classes} {...anchor}>
          {content}
        </a>
      );
    }
    return (
      <Link className={classes} {...anchor}>
        {content}
      </Link>
    );
  }

  const button = rest as ComponentPropsWithoutRef<"button">;
  return (
    <button type="button" className={classes} {...button}>
      {content}
    </button>
  );
}
