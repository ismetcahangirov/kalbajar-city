"use client";

import { useEffect } from "react";

import { cubicBezier } from "@/lib/motion/bezier";
import { onLenis, onVirtualScroll } from "@/lib/motion/frame";
import { heroSnapSettle, heroSnapTarget } from "@/lib/motion/snap";
import { ease, heroSnap } from "@/lib/motion/tokens";

/** How long the wheel must be still before a free scroll in the hero settles. */
const settleAfter = 160;

/**
 * The home hero snap (A43): on wheel input in the first viewport the page
 * snaps between the top and one viewport down, forward once the wheel has
 * asked for a fifth of a viewport, back to the top when scrolling up into
 * the hero. It rides on Lenis, so it runs only where Lenis does (a fine
 * pointer, motion allowed); keyboard, touch, the scrollbar and anchor jumps
 * are never snapped, because only wheel events reach the guard.
 */
export function useHeroSnap(): void {
  useEffect(() => {
    const easing = cubicBezier(ease.wipe);
    let stopGuard: (() => void) | null = null;
    let timer = 0;

    const stopLenis = onLenis((lenis) => {
      stopGuard?.();
      stopGuard = null;
      window.clearTimeout(timer);
      if (!lenis) return;

      let snapping = false;
      const snap = (target: number) => {
        snapping = true;
        window.clearTimeout(timer);
        lenis.scrollTo(target, {
          duration: heroSnap.duration / 1000,
          easing,
          lock: true,
          onComplete: () => {
            snapping = false;
          },
        });
      };

      stopGuard = onVirtualScroll(({ deltaY, event }) => {
        if (!(event instanceof WheelEvent)) return true;
        // A consumed turn must not scroll natively either.
        const consume = () => {
          if (event.cancelable) event.preventDefault();
          return false;
        };
        if (snapping) return consume();
        const target = heroSnapTarget(lenis.targetScroll, deltaY, window.innerHeight);
        if (target !== null) {
          snap(target);
          return consume();
        }
        // A small turn inside the hero scrolls freely, then settles.
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          const settle = heroSnapSettle(lenis.targetScroll, window.innerHeight);
          if (settle !== null) snap(settle);
        }, settleAfter);
        return true;
      });
    });

    return () => {
      stopLenis();
      stopGuard?.();
      window.clearTimeout(timer);
    };
  }, []);
}

/** `useHeroSnap` as an element-less component, for a server-rendered hero. */
export function HeroSnap() {
  useHeroSnap();
  return null;
}
