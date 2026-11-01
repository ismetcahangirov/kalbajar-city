import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cx } from "@/lib/cx";

type TextProps<T extends ElementType> = {
  as?: T;
  size?: "body-lg" | "body" | "small";
  tone?: "default" | "muted";
} & Omit<ComponentPropsWithoutRef<T>, "as">;

const sizeClass = {
  "body-lg": "text-body-lg",
  body: "text-body",
  small: "text-small",
} as const;

export function Text<T extends ElementType = "p">({
  as,
  size = "body",
  tone = "default",
  className,
  ...props
}: TextProps<T>) {
  const Tag: ElementType = as ?? "p";
  return (
    <Tag
      className={cx(
        sizeClass[size],
        tone === "muted" ? "text-text-muted" : "text-text",
        "text-pretty",
        className,
      )}
      {...props}
    />
  );
}
