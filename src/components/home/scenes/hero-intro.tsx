"use client";

import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion/env";
import { duration, ease, stagger } from "@/lib/motion/tokens";
import { onPreloaderDone, preloaderCovers } from "@/lib/shell/preloader";

/** A1 and A2 start 400 ms after the preloader has gone; A4 800 ms. */
const wipeDelay = duration.normal;
const taglineDelay = duration.slow;

/**
 * The load intro (A1–A4), played only when the preloader covered the first
 * paint: its start state is applied under the overlay and it plays once
 * the overlay has gone (`onPreloaderDone`). On a repeat visit, with reduced
 * motion and without script the hero stays as the server rendered it. The
 * panel image, the LCP element, is painted before any of this; the intro
 * only wipes its clip (motion-system.md → rule 3).
 *
 * Web Animations with `fill: "backwards"`: while one runs it wins over the
 * scrubbed inline styles of the same element, which take over when it ends.
 */
export function HeroIntro() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hero = ref.current?.closest<HTMLElement>("[data-home-hero]");
    if (!hero || !preloaderCovers() || prefersReducedMotion()) return;

    const animations: Animation[] = [];
    const add = (
      element: Element | null,
      keyframes: Keyframe[],
      timing: { easing: string; delay: number },
    ) => {
      if (!element) return;
      const animation = element.animate(keyframes, {
        duration: duration.reveal,
        fill: "backwards",
        ...timing,
      });
      animation.pause();
      animations.push(animation);
    };

    // A1: the panel exists as a panel from 668 px; below it is a plain image.
    if (window.matchMedia("(width >= 41.75rem)").matches) {
      add(
        hero.querySelector("[data-hero-panel]"),
        [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 66.66%)" }],
        { easing: ease.wipe, delay: wipeDelay },
      );
    }
    // A2
    add(
      hero.querySelector("[data-hero-tile]"),
      [
        { clipPath: "inset(100% 0 0 0)", translate: "0 5%" },
        { clipPath: "inset(0 0 0 0)", translate: "0 0" },
      ],
      { easing: ease.wipe, delay: wipeDelay },
    );
    // A3
    hero.querySelectorAll("[data-glyph]").forEach((glyph, i) =>
      add(
        glyph,
        [
          { translate: "0 100%", opacity: 0 },
          { translate: "0 0", opacity: 1 },
        ],
        { easing: ease.out, delay: i * stagger.glyph },
      ),
    );
    // A4
    hero.querySelectorAll("[data-char]").forEach((char, i) =>
      add(
        char,
        [
          { translate: "0 100%", opacity: 0 },
          { translate: "0 0", opacity: 1 },
        ],
        { easing: ease.out, delay: taglineDelay + i * stagger.char },
      ),
    );

    const stop = onPreloaderDone(() => {
      for (const animation of animations) animation.play();
    });
    return () => {
      stop();
      for (const animation of animations) animation.cancel();
    };
  }, []);

  return <span ref={ref} hidden />;
}
