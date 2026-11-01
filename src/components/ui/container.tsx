import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cx } from "@/lib/cx";

type ContainerProps<T extends ElementType> = {
  as?: T;
  size?: "page" | "prose";
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function Container<T extends ElementType = "div">({
  as,
  size = "page",
  className,
  ...props
}: ContainerProps<T>) {
  const Tag: ElementType = as ?? "div";
  return (
    <Tag
      className={cx(
        "mx-auto w-full px-page",
        size === "page"
          ? "max-w-[calc(var(--container-page)+2*var(--spacing-gutter))]"
          : "max-w-[calc(var(--container-prose)+2*var(--spacing-gutter))]",
        className,
      )}
      {...props}
    />
  );
}
