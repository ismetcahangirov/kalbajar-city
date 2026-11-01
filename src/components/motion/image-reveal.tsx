"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

import { registerEntry } from "@/lib/motion/entry";
import { isBelowViewport, prefersReducedMotion } from "@/lib/motion/env";
import { cx } from "@/lib/cx";
import { duration, ease, revealScale } from "@/lib/motion/tokens";

const closed = "inset(100% 0% 0% 0%)";
const open = "inset(0% 0% 0% 0%)";

/**
 * A frame that wipes open upward while the image inside settles from a slight
 * zoom. The frame keeps its size from CSS (an aspect ratio), so nothing
 * shifts; images in a grid stagger as they enter together.
 */
export function ImageReveal({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = ref.current;
    if (!frame || prefersReducedMotion() || !isBelowViewport(frame)) return;
    const media = frame.firstElementChild instanceof HTMLElement ? frame.firstElementChild : null;

    const show = () => {
      frame.style.clipPath = "";
      if (media) media.style.scale = "";
    };
    frame.style.clipPath = closed;
    if (media) media.style.scale = String(revealScale);

    return registerEntry(frame, {
      kind: "image",
      play: (delay) => {
        show();
        const timing = { duration: duration.wipe, delay, fill: "backwards" } as const;
        const animations = [
          frame.animate([{ clipPath: closed }, { clipPath: open }], {
            ...timing,
            easing: ease.inOut,
          }),
        ];
        if (media) {
          animations.push(
            media.animate([{ scale: String(revealScale) }, { scale: "1" }], {
              ...timing,
              easing: ease.out,
            }),
          );
        }
        return () => animations.forEach((a) => a.finish());
      },
      reveal: show,
    });
  }, []);

  return (
    <div
      ref={ref}
      data-motion="image-reveal"
      className={cx("overflow-hidden", className)}
      {...props}
    />
  );
}
