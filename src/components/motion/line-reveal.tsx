"use client";

import { useEffect, useRef, type ComponentProps } from "react";

import { Heading } from "@/components/ui/heading";
import { registerEntry } from "@/lib/motion/entry";
import { isBelowViewport, prefersReducedMotion } from "@/lib/motion/env";
import { splitLines, type SplitLines } from "@/lib/motion/split-lines";
import { duration, ease, lineRise, stagger } from "@/lib/motion/tokens";

const hiddenLine = `0 ${lineRise * 100}%`;

/**
 * A display heading whose lines rise out of a clip, one after another. For
 * headings below the fold only; the hero headline never animates. The heading
 * is split after fonts load (line breaks depend on the face), re-split if its
 * width changes before it enters, and put back to its original nodes after.
 *
 * Its children should be static text and inline elements: they are moved
 * out of the heading while it waits to enter.
 */
export function LineReveal(props: ComponentProps<typeof Heading>) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const heading = ref.current;
    if (!heading || prefersReducedMotion() || !isBelowViewport(heading)) return;

    let split: SplitLines | null = null;
    let cancelled = false;
    let unregister: (() => void) | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const restore = () => {
      split?.restore();
      split = null;
    };
    const resplit = () => {
      restore();
      split = splitLines(heading);
      for (const inner of split?.inners ?? []) inner.style.translate = hiddenLine;
    };

    void document.fonts.ready.then(() => {
      // The visitor may have scrolled to it while fonts were loading.
      if (cancelled || !isBelowViewport(heading)) return;
      resplit();
      if (!split) return;

      let width = heading.offsetWidth;
      resizeObserver = new ResizeObserver(() => {
        if (!split || heading.offsetWidth === width) return;
        width = heading.offsetWidth;
        resplit();
      });
      resizeObserver.observe(heading);

      unregister = registerEntry(heading, {
        kind: "block",
        play: (delay) => {
          resizeObserver?.disconnect();
          const animations = (split?.inners ?? []).map((inner, i) => {
            inner.style.translate = "";
            return inner.animate([{ translate: hiddenLine }, { translate: "0 0" }], {
              duration: duration.reveal,
              easing: ease.out,
              delay: delay + Math.min(i, stagger.max - 1) * stagger.block,
              fill: "backwards",
            });
          });
          void Promise.all(animations.map((a) => a.finished)).then(restore, restore);
          return () => animations.forEach((a) => a.finish());
        },
        reveal: restore,
      });
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      unregister?.();
      restore();
    };
  }, []);

  return <Heading ref={ref} data-motion="line-reveal" {...props} />;
}
