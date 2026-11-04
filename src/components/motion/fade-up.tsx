"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

import { registerEntry } from "@/lib/motion/entry";
import { isBelowViewport, prefersReducedMotion } from "@/lib/motion/env";
import { duration, ease, rise } from "@/lib/motion/tokens";

type FadeUpProps = ComponentPropsWithoutRef<"div"> & {
  as?: "div" | "section" | "header" | "ul" | "ol" | "li" | "dl" | "p";
  /** Animate the direct children instead, staggered as they enter together. */
  group?: boolean;
};

function hide(element: HTMLElement) {
  element.style.opacity = "0";
  element.style.translate = `0 ${rise}px`;
}

function show(element: HTMLElement) {
  element.style.opacity = "";
  element.style.translate = "";
}

/**
 * The one scroll-entry (motion-system.md → rule 2): opacity and a short rise.
 * The server renders the final state; only elements still below the viewport
 * after hydration are hidden, so nothing visible ever disappears.
 */
export function FadeUp({ as = "div", group = false, ...props }: FadeUpProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const targets = (group ? [...root.children] : [root]).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const cleanups = targets.filter(isBelowViewport).map((element) => {
      hide(element);
      return registerEntry(element, {
        kind: "block",
        play: (delay) => {
          show(element);
          const animation = element.animate(
            [
              { opacity: 0, translate: `0 ${rise}px` },
              { opacity: 1, translate: "0 0" },
            ],
            { duration: duration.entry, easing: ease.out, delay, fill: "backwards" },
          );
          return () => animation.finish();
        },
        reveal: () => show(element),
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [group]);

  const Tag = as as "div";
  return <Tag ref={ref} data-motion="fade-up" {...props} />;
}
