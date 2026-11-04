"use client";

import { useEffect } from "react";

import { onReducedMotion } from "@/lib/motion/env";
import { onFrame } from "@/lib/motion/frame";
import { duration } from "@/lib/motion/tokens";
import { preloaderDoneEvent } from "@/lib/shell/preloader";

/** The reference's timings: at least 1.5 s, then 1 s at 100 % before the fade. */
const MIN_DELAY = 1500;
const HOLD = 1000;
/** The displayed progress follows the real one by this much every 16 ms. */
const LERP = 0.075;

const quadInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The images the first screen needs: eager ones in the main content. */
function introImages(): HTMLImageElement[] {
  return [...document.querySelectorAll<HTMLImageElement>("main img")].filter(
    (image) => image.loading !== "lazy",
  );
}

/**
 * Drives the preloader once its inline script has shown it: progress is the
 * mean of the time elapsed over 1.5 s and the share of intro images loaded,
 * eased into the counter (`quadInOut`) and the rising curtain. At 100 % it
 * holds 1 s, fades out (`--duration-normal`), and hands off
 * (src/lib/shell/preloader.ts). Reduced motion turned on mid-way ends it at
 * once. Renders nothing.
 */
export function PreloaderDriver() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.preloader !== "on") return;
    const overlay = document.querySelector<HTMLElement>("[data-preloader-overlay]");
    const bg = overlay?.querySelector<HTMLElement>("[data-preloader-bg]");
    const count = overlay?.querySelector<HTMLElement>("[data-preloader-count]");

    const images = introImages();
    let loaded = 0;
    const settle = () => (loaded += 1);
    for (const image of images) {
      if (image.complete) loaded += 1;
      else {
        image.addEventListener("load", settle, { once: true });
        image.addEventListener("error", settle, { once: true });
      }
    }

    const start = performance.now();
    let shown = 0;
    let last = start;
    let timers: number[] = [];
    let finished = false;

    const finish = (fade: boolean) => {
      if (finished) return;
      finished = true;
      root.dataset.preloader = "out";
      timers.push(
        window.setTimeout(
          () => {
            root.dataset.preloader = "done";
            window.dispatchEvent(new Event(preloaderDoneEvent));
          },
          fade ? duration.normal : 0,
        ),
      );
    };

    const stopFrame = onFrame((time) => {
      const elapsed = Math.min(1, (time - start) / MIN_DELAY);
      const assets = images.length ? loaded / images.length : 1;
      const target = (elapsed + assets) / 2;
      // Frame-rate independent lerp, as the reference's 16 ms steps.
      shown += (target - shown) * (1 - (1 - LERP) ** ((time - last) / 16));
      last = time;
      if (target >= 1 && 1 - shown < 0.001) shown = 1;
      bg?.style.setProperty("translate", `0 ${(100 * (1 - shown)).toFixed(2)}%`);
      if (count) count.textContent = `${Math.ceil(quadInOut(shown) * 100)}%`;
      if (shown < 1) return true;
      timers.push(window.setTimeout(() => finish(true), HOLD));
      return false;
    });

    const stopReduced = onReducedMotion(() => finish(false));
    return () => {
      stopFrame();
      stopReduced();
      for (const timer of timers) window.clearTimeout(timer);
      timers = [];
      if (!finished) finish(false);
    };
  }, []);

  return null;
}
