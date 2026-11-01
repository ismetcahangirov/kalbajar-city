import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

export type BadgeVariant = "available" | "reserved" | "sold" | "neutral" | "illustrative";

const variantClass: Record<BadgeVariant, string> = {
  available: "text-status-available",
  reserved: "text-status-reserved",
  sold: "text-status-sold",
  neutral: "text-text-muted",
  illustrative: "text-text-muted",
};

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant: BadgeVariant;
  /** The visible word, from the message catalogue. Colour never stands alone. */
  children: string;
};

/**
 * Apartment status, a neutral label, or the `Illustrative` chip on generated
 * imagery. Status variants are for light surfaces only.
 */
export function Badge({ variant, className, children, ...props }: BadgeProps) {
  const isStatus = variant === "available" || variant === "reserved" || variant === "sold";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-xs border border-current bg-surface-raised px-2 py-0.5",
        "text-small font-medium",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {isStatus && <span aria-hidden className="size-2 rounded-full bg-current" />}
      {children}
    </span>
  );
}
