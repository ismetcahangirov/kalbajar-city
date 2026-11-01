import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

type EyebrowProps = ComponentPropsWithoutRef<"p"> & {
  /** A heading level when the eyebrow titles a group, such as a footer column. */
  as?: "p" | "span" | "h2" | "h3";
};

export function Eyebrow({ as: Tag = "p", className, ...props }: EyebrowProps) {
  return <Tag className={cx("text-eyebrow text-text-accent uppercase", className)} {...props} />;
}
