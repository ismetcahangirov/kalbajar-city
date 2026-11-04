"use client";

import { useMemo, useRef, type ElementType } from "react";

import { cx } from "@/lib/cx";
import type { RangeInput } from "@/lib/motion/range";
import {
  explodeOffsets,
  graphemes,
  spreadOffsets,
  staircaseOffsets,
} from "@/lib/motion/split-word";
import type { ScrubEase } from "@/lib/motion/tokens";

import { useScrub, type Trigger } from "./use-scrub";

export type SplitWordMode = "static" | "spread" | "explode" | "staircase";

/** The catalogue's range and easing per animation (motion-system.md → Per-letter word animations). */
const defaults: Record<Exclude<SplitWordMode, "static">, { range: string; easing: ScrubEase }> = {
  spread: { range: "100-0 → 0-0", easing: "quadOut" },
  explode: { range: "-150-0 → -250-0", easing: "quadIn" },
  staircase: { range: "100-0 → 25-0", easing: "quadIn" },
};

type SplitWordProps = {
  /** The word, from the message catalogue. Rendered as the caller cases it (`uppercase`). */
  word: string;
  mode?: SplitWordMode;
  range?: RangeInput;
  easing?: ScrubEase;
  /** What the range is measured against; `scene` inside a pinned layer. */
  trigger?: Trigger;
  /** Keeps the scrub on touch and narrow screens (the staircase's mobile variant). */
  mobile?: boolean;
  /** For grapheme segmentation and `uppercase` casing (`İ`/`i`, `I`/`ı`). */
  lang?: string;
  as?: ElementType;
  className?: string;
  [data: `data-${string}`]: string | undefined;
};

/**
 * The giant word (ui-kit.md → Components): one element per grapheme
 * (`Intl.Segmenter`, so `Ə` and `İ` stay whole) spread edge to edge with
 * `space-between`, inside a clip. The whole word is `aria-hidden`: the
 * caller renders the real heading, visually hidden, next to it.
 *
 * `spread` (A14) starts with the letters bunched toward the centre, `explode`
 * (A15) flies them outward, `staircase` (A16) raises each one out of the
 * clip; offsets come from the letter count, so any word works. The server
 * renders the letters at rest, which is also the reduced-motion, touch and
 * no-script state.
 */
export function SplitWord({
  word,
  mode = "static",
  range,
  easing,
  trigger = "self",
  mobile = false,
  lang,
  as: Tag = "div",
  className,
  ...props
}: SplitWordProps) {
  const ref = useRef<HTMLElement>(null);
  const letters = useMemo(() => graphemes(word, lang), [word, lang]);
  const animated = mode !== "static";
  const preset = defaults[animated ? mode : "spread"];

  useScrub(
    ref,
    {
      range: range ?? preset.range,
      easing: easing ?? preset.easing,
      trigger,
      mode: mobile ? "always" : "desktop",
      enabled: animated,
    },
    (progress) => {
      const spans = ref.current?.children;
      if (!spans) return;
      const n = spans.length;
      const offsets =
        mode === "explode"
          ? explodeOffsets(n)
          : mode === "staircase"
            ? staircaseOffsets(n)
            : spreadOffsets(n);
      // spread and staircase come to rest at the end; explode leaves it.
      const share = mode === "explode" ? progress : 1 - progress;
      for (let i = 0; i < n; i++) {
        const span = spans[i] as HTMLElement;
        const value = (offsets[i]! * share).toFixed(3);
        span.style.translate = mode === "staircase" ? `0 ${value}vw` : `${value}vw 0`;
      }
    },
    () => {
      for (const span of ref.current?.children ?? []) {
        (span as HTMLElement).style.removeProperty("translate");
      }
    },
  );

  return (
    <Tag
      ref={ref}
      data-split-word={mode}
      aria-hidden="true"
      lang={lang}
      className={cx(className)}
      {...props}
    >
      {letters.map((letter, i) => (
        <span key={i} data-letter="">
          {letter === " " ? "\u00a0" : letter}
        </span>
      ))}
    </Tag>
  );
}
