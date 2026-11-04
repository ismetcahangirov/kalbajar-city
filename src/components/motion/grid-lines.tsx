"use client";

import { useRef } from "react";

import { cx } from "@/lib/cx";
import { instantly } from "@/lib/motion/env";

import type { Trigger } from "./use-scrub";
import { useThreshold } from "./use-threshold";

export type GridLinesVariant = "half" | "thirds" | "quarters" | "wider";

/** Line positions in percent of the full-bleed width (ui-kit.md → Grid lines). */
const positions: Record<GridLinesVariant, number[]> = {
  half: [50],
  thirds: [100 / 3, 200 / 3],
  quarters: [25, 50, 75],
  wider: [25, 75],
};

type GridLinesProps = {
  variant?: GridLinesVariant;
  /** `--t-line-alt` (30 % on dark) instead of `--t-line`. */
  alt?: boolean;
  /** Every line under 668 px too; by default mobile shows only the first. */
  mobileAll?: boolean;
  /**
   * Draws the lines in (A13: `scaleY` 0 → 1 from alternating ends, reversible)
   * when this scroll point is passed. Off: the lines are static.
   */
  draw?: boolean;
  /** The point at which they draw in; the parent's top at 90 % of the viewport by default. */
  drawAt?: string;
  trigger?: Trigger;
  className?: string;
};

/**
 * The page's skeleton: 1 px verticals behind the content, absolutely
 * positioned in the nearest positioned ancestor (make it `relative`, full
 * bleed). Decorative and `aria-hidden`.
 */
export function GridLines({
  variant = "thirds",
  alt = false,
  mobileAll = false,
  draw = false,
  drawAt = "90svh",
  trigger = "self",
  className,
}: GridLinesProps) {
  const ref = useRef<HTMLDivElement>(null);
  useThreshold(
    ref,
    { at: drawAt, trigger, enabled: draw },
    (passed, initial) => {
      const element = ref.current;
      if (!element) return;
      const state = passed > 0 ? "in" : "out";
      if (initial) instantly(element, () => (element.dataset.state = state));
      else element.dataset.state = state;
    },
    () => {
      if (ref.current) delete ref.current.dataset.state;
    },
  );

  return (
    <div
      ref={ref}
      data-grid-lines={variant}
      aria-hidden="true"
      className={cx("pointer-events-none absolute inset-0 -z-1", className)}
    >
      {positions[variant].map((left, i) => (
        <span
          key={left}
          data-grid-line=""
          className={cx(
            "absolute inset-y-0 w-(--grid-line-width)",
            alt ? "bg-(--t-line-alt)" : "bg-(--t-line)",
            i > 0 && !mobileAll && "hidden desk:block",
          )}
          style={{ left: `${left}%` }}
        />
      ))}
    </div>
  );
}
