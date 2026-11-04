"use client";

import { useRef, type ElementType, type ReactNode } from "react";

import { instantly } from "@/lib/motion/env";

import type { Trigger } from "./use-scrub";
import { useThreshold, type ThresholdOptions } from "./use-threshold";

type ThresholdProps = Omit<ThresholdOptions, "enabled" | "trigger"> & {
  as?: ElementType;
  trigger?: Trigger;
  className?: string;
  children?: ReactNode;
  [data: `data-${string}`]: string | undefined;
  "aria-hidden"?: boolean | "true" | "false";
  id?: string;
};

/**
 * Sets `data-state="in"` once the point is passed and `"out"` before it,
 * both ways (reversible, as in the reference). Style both states with CSS
 * transitions from the tokens, for example
 * `transition-[clip-path] duration-(--duration-reveal) ease-(--ease-wipe)
 * data-[state=out]:duration-(--duration-slow)
 * data-[state=out]:[clip-path:inset(100%_0_0_0)]`.
 *
 * Without the attribute (no script, reduced motion, touch) the element is
 * in its final state, so style only `data-[state=out]` as the start.
 */
export function Threshold({
  as: Tag = "div",
  at,
  trigger,
  mode,
  className,
  children,
  ...props
}: ThresholdProps) {
  const ref = useRef<HTMLElement>(null);
  useThreshold(
    ref,
    { at, trigger, mode },
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
    <Tag ref={ref} data-threshold="" className={className} {...props}>
      {children}
    </Tag>
  );
}
