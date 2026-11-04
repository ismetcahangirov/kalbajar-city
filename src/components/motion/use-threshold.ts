"use client";

import { useEffect, useRef, type RefObject } from "react";

import { whileMotion, type MotionMode } from "@/lib/motion/env";
import { onMeasure, onScrollFrame } from "@/lib/motion/frame";
import { parsePoint, pointsPassed, type Geometry } from "@/lib/motion/range";

import { measure, resolveTrigger, type Trigger } from "./use-scrub";

export type ThresholdOptions = {
  /**
   * The point (`"90svh"`, `"80-0"`, `"-150%"`), or several in scroll order:
   * the state is then how many have been passed.
   */
  at: string | readonly string[];
  trigger?: Trigger;
  mode?: MotionMode;
  enabled?: boolean;
};

/**
 * Crossing state from cached geometry (docs/motion-system.md → Primitives):
 * `onChange(passed, initial)` runs once when motion starts and whenever the
 * number of points passed changes, scrolling either way (reversible).
 * `initial` is true for the first call, where the caller applies its state
 * without a transition. An element already in or above the viewport then
 * counts as past the first point, so nothing a visitor can see is hidden.
 * `reset` restores the final state when motion stops.
 */
export function useThreshold(
  ref: RefObject<HTMLElement | null>,
  options: ThresholdOptions,
  onChange: (passed: number, initial: boolean) => void,
  reset?: () => void,
): void {
  const { at, trigger = "self", mode = "desktop" } = options;
  const enabled = options.enabled ?? true;
  const key = typeof at === "string" ? at : at.join("|");
  const callbacks = useRef({ onChange, reset });
  useEffect(() => {
    callbacks.current = { onChange, reset };
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const points = key.split("|").map(parsePoint);
    return whileMotion(mode, () => {
      const target = resolveTrigger(element, trigger);
      let geometry: Geometry | null = null;
      let last = -1;
      let visibleAtStart = false;
      const stopMeasure = onMeasure(() => {
        geometry = measure(target);
      });
      const stopScroll = onScrollFrame((scrollY) => {
        if (!geometry) return;
        let passed = pointsPassed(points, geometry, scrollY);
        if (last === -1) {
          // Read once, at start: is the element on screen already?
          visibleAtStart = element.getBoundingClientRect().top < window.innerHeight;
        }
        if (visibleAtStart && passed === 0) passed = 1;
        else visibleAtStart = false;
        if (passed === last) return;
        const initial = last === -1;
        last = passed;
        callbacks.current.onChange(passed, initial);
      });
      return () => {
        stopMeasure();
        stopScroll();
        callbacks.current.reset?.();
      };
    });
  }, [ref, key, trigger, mode, enabled]);
}
