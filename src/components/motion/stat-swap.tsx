"use client";

import { useRef, type ReactNode } from "react";

import { cx } from "@/lib/cx";
import { instantly } from "@/lib/motion/env";

import type { Trigger } from "./use-scrub";
import { useThreshold } from "./use-threshold";

export type StatSet = {
  key: string;
  /** The small word over the start number ("-dan"). */
  fromLabel?: ReactNode;
  from: ReactNode;
  /** The centred label, between the two lines. */
  label: ReactNode;
  toLabel?: ReactNode;
  to: ReactNode;
};

type StatSwapProps = {
  sets: StatSet[];
  /**
   * One scroll point per set, in scroll order: set `i` shows from point `i`
   * on, the lines draw at the first (A30), and each later point swaps the
   * numbers and labels (A31). Scrolling back reverses.
   */
  at: readonly string[];
  /** `scene` when the stats sit in a pinned layer. */
  trigger?: Trigger;
  className?: string;
  [data: `data-${string}`]: string | undefined;
};

function Slot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span data-swap-slot="" className={cx("block", className)}>
      <span data-swap-item="">{children}</span>
    </span>
  );
}

/**
 * Stats at the far edges with a label between two 1 px lines drawing outward
 * from it (A30), swapping set after set through each slot's clip (A31:
 * `translateY(±140%)`, leave +200 ms, enter +400 ms). The server renders every
 * set as its own row, which is the final state for reduced motion, touch and
 * no script and what assistive tech reads; on desktop the rows share one line
 * after hydration, only when the stats are below the viewport.
 */
export function StatSwap({ sets, at, trigger = "self", className, ...props }: StatSwapProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Stats already on screen at hydration stay stacked: collapsing them
  // there would shift what the visitor is looking at.
  const stacked = useRef(false);

  useThreshold(
    ref,
    { at, trigger },
    (passed, initial) => {
      const root = ref.current;
      if (!root) return;
      if (initial) stacked.current = root.getBoundingClientRect().top < window.innerHeight;
      if (stacked.current) return;
      const apply = () => {
        root.dataset.swap = "";
        root.dataset.lines = passed > 0 ? "in" : "out";
        const active = Math.max(0, passed - 1);
        [...root.children].forEach((row, i) => {
          const state = passed > 0 && i === active ? "in" : i < active ? "before" : "after";
          (row as HTMLElement).dataset.rowState = state;
        });
      };
      if (initial) instantly(root, apply);
      else apply();
    },
    () => {
      const root = ref.current;
      stacked.current = false;
      if (!root) return;
      delete root.dataset.swap;
      delete root.dataset.lines;
      for (const row of root.children) delete (row as HTMLElement).dataset.rowState;
    },
  );

  return (
    <div ref={ref} data-stat-swap="" className={className} {...props}>
      {sets.map((set) => (
        <p
          key={set.key}
          data-stat-set=""
          className="flex flex-col items-center gap-u text-center desk:grid desk:grid-cols-[auto_1fr_auto_1fr_auto] desk:items-center desk:gap-x-u2 desk:text-start"
        >
          <span className="flex flex-col items-center desk:items-start">
            {set.fromLabel && (
              <Slot className="text-label text-(--t-small) uppercase">{set.fromLabel}</Slot>
            )}
            <Slot className="text-word font-light">{set.from}</Slot>
          </span>
          <span
            data-stat-line=""
            aria-hidden="true"
            className="hidden h-(--grid-line-width) origin-right bg-(--t-line-alt) desk:block"
          />
          <Slot className="text-label text-(--t-small) uppercase">{set.label}</Slot>
          <span
            data-stat-line=""
            aria-hidden="true"
            className="hidden h-(--grid-line-width) origin-left bg-(--t-line-alt) desk:block"
          />
          <span className="flex flex-col items-center desk:items-end">
            {set.toLabel && (
              <Slot className="text-label text-(--t-small) uppercase">{set.toLabel}</Slot>
            )}
            <Slot className="text-word font-light">{set.to}</Slot>
          </span>
        </p>
      ))}
    </div>
  );
}
