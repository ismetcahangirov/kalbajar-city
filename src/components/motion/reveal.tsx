"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

import { instantly, isBelowViewport, whileMotion } from "@/lib/motion/env";
import { onMeasure, onScrollFrame } from "@/lib/motion/frame";
import { parsePoint, scrollAt, type Geometry } from "@/lib/motion/range";
import { registerReveal } from "@/lib/motion/reveal";
import { splitLines, type SplitLines } from "@/lib/motion/split-lines";
import { delay, duration, stagger } from "@/lib/motion/tokens";

import { measure, resolveTrigger, type Trigger } from "./use-scrub";

export type RevealKind = "text" | "image-in" | "clip-down" | "clip-up";

type RevealProps = {
  /**
   * `text` (A11): lines rise out of a blur one after another. `image-in`
   * (A12): out of a blur. `clip-down` (A39) and `clip-up` (A29): wiped open.
   */
  kind: RevealKind;
  as?: ElementType;
  /** Reveals the direct children instead, staggered by `--stagger-group`. */
  group?: boolean;
  /**
   * A scroll point (`"90svh"`, `"80-0"`): the reveal plays when the point is
   * passed and reverses when scrolled back above it (A11, A29). Without it
   * the reveal plays on entry into the viewport, once (A12, A39).
   */
  at?: string;
  /** What `at` is measured against; `scene` inside a pinned layer. */
  trigger?: Trigger;
  /** On entry: plays again each time it is scrolled back into view from below. */
  reversible?: boolean;
  className?: string;
  children?: ReactNode;
  id?: string;
  [data: `data-${string}`]: string | undefined;
};

type Item = {
  element: HTMLElement;
  split: SplitLines | null;
  width: number;
};

const isHeading = (element: Element) => /^H[1-6]$/.test(element.tagName);

/**
 * Reveal on entry or at a scroll point (spec §6.2–6.3, docs/motion-system.md
 * → Time-based transitions). CSS transitions in src/styles/scenes.css play
 * the change; this sets `data-state` on each target.
 *
 * Desktop only (a fine pointer at 668 px and up), as in the reference; on
 * touch, under reduced motion and without script the content is static and
 * final. After hydration only targets entirely below the viewport are hidden
 * (Hidden-until-ready). `text` splits into measured lines once fonts are
 * loaded, re-splits when its width changes, keeps one accessible string, and
 * puts its own nodes back once a one-time reveal has played.
 */
export function Reveal({
  kind,
  as: Tag = "div",
  group = false,
  at,
  trigger = "self",
  reversible = false,
  className,
  children,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    return whileMotion("desktop", () => {
      let cancelled = false;
      const cleanups: Array<() => void> = [];
      const items: Item[] = (group ? [...root.children] : [root])
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
        .map((element) => ({ element, split: null, width: 0 }));

      const split = (item: Item) => {
        if (kind !== "text") return;
        item.split?.restore();
        item.split = splitLines(item.element, {
          label: isHeading(item.element) ? "aria-label" : "copy",
        });
        item.width = item.element.offsetWidth;
      };
      const finalize = (item: Item) => {
        delete item.element.dataset.state;
        item.element.style.removeProperty("--reveal-delay");
        item.split?.restore();
        item.split = null;
      };
      const show = (item: Item, wait: number, once: boolean) => {
        item.element.style.setProperty("--reveal-delay", `${wait}ms`);
        item.element.dataset.state = "in";
        if (!once) return;
        // Hand the element back in its own nodes once the reveal has played.
        const lines = item.split?.inners.length ?? 1;
        const timer = window.setTimeout(
          () => finalize(item),
          wait + duration.reveal + lines * stagger.line + 100,
        );
        cleanups.push(() => window.clearTimeout(timer));
      };
      const hide = (item: Item, now: boolean) => {
        const apply = () => {
          item.element.style.setProperty("--reveal-delay", "0ms");
          item.element.dataset.state = "out";
        };
        if (now) instantly(item.element, apply);
        else apply();
      };

      const start = () => {
        if (cancelled) return;
        for (const item of items) {
          if (group) item.element.dataset.reveal = kind;
          split(item);
        }
        if (kind === "text") {
          const resize = new ResizeObserver(() => {
            for (const item of items) {
              if (item.split && item.element.offsetWidth !== item.width) split(item);
            }
          });
          for (const item of items) resize.observe(item.element);
          cleanups.push(() => resize.disconnect());
        }
        if (at) watchPoint();
        else watchEntry();
      };

      // On entry: an IntersectionObserver shared by every Reveal.
      const watchEntry = () => {
        for (const item of items) {
          if (!isBelowViewport(item.element)) {
            finalize(item);
            continue;
          }
          hide(item, true);
          cleanups.push(
            registerReveal(
              item.element,
              {
                enter: (wait) => show(item, wait, !reversible),
                leave: reversible ? () => hide(item, false) : undefined,
              },
              { group },
            ),
          );
        }
      };

      // At a scroll point: cached geometry in the shared frame loop.
      const watchPoint = () => {
        const point = parsePoint(at!);
        const target = resolveTrigger(root, trigger);
        let geometry: Geometry | null = null;
        let maxScroll = Infinity;
        let state: "in" | "out" | null = null;
        cleanups.push(
          onMeasure(() => {
            geometry = measure(target);
            maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          }),
          onScrollFrame((scrollY) => {
            if (!geometry) return;
            const passed = scrollY >= scrollAt(point, geometry) || scrollY >= maxScroll - 2;
            if (state === null && !passed && !isBelowViewport(root)) {
              // Already on screen: it stays as rendered.
              state = "in";
              return;
            }
            const next = passed ? "in" : "out";
            if (next === state) return;
            const initial = state === null;
            state = next;
            items.forEach((item, i) => {
              if (next === "out") hide(item, initial);
              else if (!initial) show(item, delay.reveal + i * stagger.group, false);
            });
          }),
        );
      };

      if (kind === "text") void document.fonts.ready.then(start);
      else start();

      return () => {
        cancelled = true;
        for (const cleanup of cleanups) cleanup();
        for (const item of items) {
          finalize(item);
          if (group) delete item.element.dataset.reveal;
        }
      };
    });
  }, [kind, group, at, trigger, reversible]);

  return (
    <Tag
      ref={ref}
      data-reveal={group ? undefined : kind}
      data-reveal-group={group ? kind : undefined}
      className={className}
      {...props}
    >
      {children}
    </Tag>
  );
}
