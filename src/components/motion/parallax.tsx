"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

import { hasFinePointer, onReducedMotion, prefersReducedMotion } from "@/lib/motion/env";
import { cx } from "@/lib/cx";
import { documentTop, onMeasure, onScrollFrame } from "@/lib/motion/frame";
import { parallax } from "@/lib/motion/tokens";

type ParallaxProps = ComponentPropsWithoutRef<"div"> & {
  /**
   * `inline`: the media drifts inside its frame while the frame crosses the
   * viewport. `hero`: the media moves at half the scroll speed while the page
   * rises over it.
   */
  variant?: "inline" | "hero";
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Transform-only depth for the hero and full-bleed images, scrubbed by the
 * scroll position. Desktop pointers only: with native touch scrolling a
 * scrubbed layer lags the finger. The media fills the frame; size the frame.
 */
export function Parallax({ variant = "inline", className, children, ...props }: ParallaxProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const media = mediaRef.current;
    if (!frame || !media || prefersReducedMotion() || !hasFinePointer()) return;

    let top = 0;
    let height = 0;
    let viewport = 0;
    let applied = "";

    const stopMeasure = onMeasure(() => {
      top = documentTop(frame);
      height = frame.offsetHeight;
      viewport = window.innerHeight;
    });
    const stopScroll = onScrollFrame((scrollY) => {
      const offset =
        variant === "hero"
          ? clamp01((scrollY - top) / height) * parallax.heroTravel
          : (clamp01((scrollY - top + viewport) / (height + viewport)) * 2 - 1) * parallax.travel;
      const next = `0 ${offset.toFixed(2)}%`;
      if (next !== applied) {
        media.style.translate = next;
        applied = next;
      }
    });
    const stop = () => {
      stopMeasure();
      stopScroll();
      media.style.translate = "";
    };
    const stopReduced = onReducedMotion(stop);
    return () => {
      stopReduced();
      stop();
    };
  }, [variant]);

  return (
    <div
      ref={frameRef}
      data-motion="parallax"
      data-variant={variant}
      className={cx("relative overflow-hidden", className)}
      {...props}
    >
      <div ref={mediaRef} data-parallax-media="" className="size-full">
        {children}
      </div>
    </div>
  );
}
