"use client";

import { useEffect, useRef, type RefObject } from "react";

import { whileMotion, type MotionMode } from "@/lib/motion/env";
import { layoutTop, onMeasure, onScrollFrame } from "@/lib/motion/frame";
import { parseRange, rangeProgress, type Geometry, type RangeInput } from "@/lib/motion/range";
import { scrubEase, type ScrubEase } from "@/lib/motion/tokens";

/**
 * What the range is measured against: the element itself (`self`), the
 * `Scene` it is in (`scene`, for anything inside a pinned layer), or another
 * element.
 */
export type Trigger = "self" | "scene" | RefObject<HTMLElement | null>;

export function resolveTrigger(element: HTMLElement, trigger: Trigger): HTMLElement {
  if (trigger === "self") return element;
  if (trigger === "scene") {
    const scene = element.closest<HTMLElement>("[data-scroll-scene]");
    if (!scene) throw new Error('trigger "scene" needs the element inside a <Scene>');
    return scene;
  }
  return trigger.current ?? element;
}

/** Measures `trigger` on resize, never in a scroll frame. */
export function measure(trigger: HTMLElement): Geometry {
  return { top: layoutTop(trigger), height: trigger.offsetHeight, viewport: window.innerHeight };
}

export type ScrubOptions = {
  /** The reference notation, `"100-0 → 0-0"` (docs/motion-system.md → Ranges). */
  range: RangeInput;
  /** `linear` (the default), `quadOut`, `quadIn` or `quadInOut`. */
  easing?: ScrubEase;
  trigger?: Trigger;
  /** False lets progress run past 0…1 (the wordmark peel, A6). */
  clamp?: boolean;
  /** `desktop` (the default) or `always`, for a mobile variant that keeps the effect. */
  mode?: MotionMode;
  /** Off: nothing is written and the server's final state stays. */
  enabled?: boolean;
};

/**
 * Scroll-scrubbed progress (docs/motion-system.md → Primitives): geometry is
 * measured on resize (`onMeasure`), progress is computed in the shared frame
 * loop from cached numbers only, eased, and passed to `apply` whenever it
 * changed. `apply` writes `transform`, `clip-path` or `opacity` to refs,
 * never React state. `reset` runs when motion stops (reduced motion turned
 * on, a narrow window, unmount) and must put back the server's final state.
 *
 * Nothing runs under reduced motion, on touch or under 668 px (unless
 * `mode: "always"`), or before hydration, so those keep the final state.
 */
export function useScrub(
  ref: RefObject<HTMLElement | null>,
  options: ScrubOptions,
  apply: (progress: number) => void,
  reset?: () => void,
): void {
  const { range, easing = "linear", trigger = "self", clamp = true, mode = "desktop" } = options;
  const enabled = options.enabled ?? true;
  const key = typeof range === "string" ? range : range.join(" → ");
  // The latest callbacks, without restarting the effect on every render.
  const callbacks = useRef({ apply, reset });
  useEffect(() => {
    callbacks.current = { apply, reset };
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const parsed = parseRange(key);
    const ease = scrubEase[easing];
    return whileMotion(mode, () => {
      const target = resolveTrigger(element, trigger);
      let geometry: Geometry | null = null;
      let last = Number.NaN;
      const stopMeasure = onMeasure(() => {
        geometry = measure(target);
      });
      const stopScroll = onScrollFrame((scrollY) => {
        if (!geometry) return;
        const t = rangeProgress(parsed, geometry, scrollY, clamp);
        const eased = clamp ? ease(t) : t;
        if (eased === last) return;
        last = eased;
        callbacks.current.apply(eased);
      });
      return () => {
        stopMeasure();
        stopScroll();
        callbacks.current.reset?.();
      };
    });
  }, [ref, key, easing, trigger, clamp, mode, enabled]);
}
