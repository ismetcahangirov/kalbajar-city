import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

export function Eyebrow({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cx("text-eyebrow text-text-accent uppercase", className)} {...props} />;
}
