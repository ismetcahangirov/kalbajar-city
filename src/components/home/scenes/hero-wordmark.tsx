"use client";

import { useMemo, useRef } from "react";

import { useScrub } from "@/components/motion/use-scrub";
import { cx } from "@/lib/cx";
import { graphemes } from "@/lib/motion/split-word";

/** A6: glyph `i` rises by `(50 + 75 i) %` of its height per viewport of scroll. */
const peel = (i: number) => 50 + 75 * i;

/**
 * The hero wordmark (S0): the brand spread over the left two thirds, one
 * glyph per mask, so the load intro (A3, `hero-intro.tsx`) can raise each
 * out of its own clip and the scroll peels them off one after another (A6,
 * linear and unclamped over the hero's first viewport). Decorative: the
 * header carries the brand's name. The server renders the glyphs at rest,
 * which is also the state without script, on touch and with reduced motion.
 */
export function HeroWordmark({ word, lang }: { word: string; lang?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const glyphs = useMemo(() => graphemes(word, lang), [word, lang]);

  useScrub(
    ref,
    { range: "0-0 → -100-0", trigger: "scene", clamp: false },
    (progress) => {
      const spans = ref.current?.querySelectorAll<HTMLElement>("[data-glyph]") ?? [];
      spans.forEach((span, i) => {
        span.style.translate = `0 ${(-peel(i) * Math.max(0, progress)).toFixed(2)}%`;
      });
    },
    () => {
      ref.current
        ?.querySelectorAll<HTMLElement>("[data-glyph]")
        .forEach((span) => span.style.removeProperty("translate"));
    },
  );

  return (
    <p
      ref={ref}
      aria-hidden="true"
      lang={lang}
      data-hero-mark=""
      className="flex w-[66.7vw] justify-between text-hero-mark text-(--t-primary) uppercase desk:w-[50vw]"
    >
      {glyphs.map((glyph, i) => (
        <span key={i} className={cx("block overflow-clip", glyph === " " && "w-[0.3em]")}>
          <span data-glyph="" className="block">
            {glyph === " " ? " " : glyph}
          </span>
        </span>
      ))}
    </p>
  );
}
