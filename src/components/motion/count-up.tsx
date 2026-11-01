"use client";

import { useEffect, useRef } from "react";

import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { cubicBezier } from "@/lib/motion/bezier";
import { registerEntry } from "@/lib/motion/entry";
import { isBelowViewport, prefersReducedMotion } from "@/lib/motion/env";
import { onFrame } from "@/lib/motion/frame";
import { duration, ease } from "@/lib/motion/tokens";

type CountUpProps = {
  value: number;
  locale: Locale;
  maximumFractionDigits?: number;
};

/**
 * A numeral that counts up from zero when it enters, formatted per locale on
 * every frame. The final value stays in the flow, transparent while counting,
 * so it holds the width (Alethia has no tabular figures) and is what
 * assistive tech reads; the counting copy floats over it and is hidden from
 * assistive tech.
 */
export function CountUp({ value, locale, maximumFractionDigits = 0 }: CountUpProps) {
  const finalRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const final = finalRef.current;
    const live = liveRef.current;
    if (!final || !live || prefersReducedMotion() || !isBelowViewport(final)) return;

    const format = (n: number) => formatNumber(n, locale, { maximumFractionDigits });
    const show = () => {
      final.style.opacity = "";
      live.hidden = true;
      live.textContent = "";
    };
    final.style.opacity = "0";
    live.textContent = format(0);
    live.hidden = false;

    return registerEntry(final, {
      kind: "block",
      play: (delay) => {
        const eased = cubicBezier(ease.out);
        const start = performance.now() + delay;
        // On the shared frame loop, after the scroll listeners, so its text
        // writes never precede a layout read in the same frame.
        const stop = onFrame((now) => {
          const t = Math.min(1, Math.max(0, (now - start) / duration.count));
          live.textContent = format(value * eased(t));
          if (t < 1) return true;
          show();
          return false;
        });
        return () => {
          stop();
          show();
        };
      },
      reveal: show,
    });
  }, [value, locale, maximumFractionDigits]);

  return (
    <span data-motion="count-up" className="relative inline-grid">
      <span ref={finalRef}>{formatNumber(value, locale, { maximumFractionDigits })}</span>
      <span
        ref={liveRef}
        aria-hidden="true"
        hidden
        className="absolute start-0 top-0 whitespace-nowrap"
      />
    </span>
  );
}
