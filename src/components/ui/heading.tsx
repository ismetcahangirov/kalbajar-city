import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

export type HeadingSize = "display-xl" | "display" | "heading" | "title";

const sizeClass: Record<HeadingSize, string> = {
  "display-xl": "text-display-xl",
  display: "text-display",
  heading: "text-heading",
  title: "text-title",
};

type HeadingProps = ComponentPropsWithoutRef<"h2"> & {
  /** Document level. Independent of the visual size. */
  as: "h1" | "h2" | "h3" | "h4";
  size: HeadingSize;
  align?: "start" | "center";
};

/** One `<em>` inside renders in Alethia Italic (see globals.css). */
export function Heading({ as: Tag, size, align = "start", className, ...props }: HeadingProps) {
  return (
    <Tag
      className={cx(
        sizeClass[size],
        "text-balance",
        align === "center" && "mx-auto text-center",
        className,
      )}
      {...props}
    />
  );
}
