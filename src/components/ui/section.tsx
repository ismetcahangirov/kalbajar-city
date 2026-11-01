import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

export type Tone = "paper" | "limestone" | "night";

type SectionProps = ComponentPropsWithoutRef<"section"> & {
  tone?: Tone;
};

/**
 * A page section with the section rhythm. `night` switches the semantic
 * tokens for the subtree; `limestone` uses the alternate surface.
 */
export function Section({ tone = "paper", className, ...props }: SectionProps) {
  return (
    <section
      data-tone={tone === "night" ? "night" : undefined}
      className={cx(
        "py-section",
        tone === "limestone" ? "bg-surface-alt" : "bg-surface",
        "text-text",
        className,
      )}
      {...props}
    />
  );
}
