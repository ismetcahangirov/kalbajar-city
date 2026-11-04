"use client";

import { useRef, type ReactNode } from "react";

import { useCursorFollower } from "@/components/motion/use-cursor-follower";

// Playground demos of `useCursorFollower` (#63). The real components, the
// next-page teaser (#64) and `TripleCarousel` (#66), copy this wiring.

/** The next-page teaser: the whole block is the link; the 120 px "KEÇ" button follows the pointer. */
export function TeaserDemo({ href, children }: { href: string; children: ReactNode }) {
  const area = useRef<HTMLAnchorElement>(null);
  const button = useRef<HTMLSpanElement>(null);
  useCursorFollower(area, button);
  return (
    <a
      ref={area}
      href={href}
      data-testid="teaser"
      className="relative isolate flex h-[30rem] items-end overflow-hidden px-layout pb-u3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--t-text)"
    >
      {children}
      {/* At rest, centred: what touch, reduced motion and no script show. */}
      <span
        ref={button}
        data-follower=""
        aria-hidden="true"
        className="absolute top-[calc(50%-3.75rem)] left-[calc(50%-3.75rem)] flex size-30 items-center justify-center rounded-full bg-(--t-text) text-label text-(--t-bg) uppercase"
      >
        Keç
      </span>
    </a>
  );
}

/**
 * A carousel's cursor (A35): over the left half the 30 px arrow points back,
 * over the right half forward. The buttons are the real controls; the arrow
 * is decoration.
 */
export function CarouselDemo({ children }: { children: ReactNode }) {
  const area = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useCursorFollower(area, arrow);
  const step = (direction: 1 | -1) =>
    track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.5 });
  return (
    <div ref={area} data-testid="carousel" className="group relative">
      <div
        ref={track}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-u overflow-x-auto px-layout"
      >
        {children}
      </div>
      <div className="mt-u2 flex justify-end gap-u px-layout">
        <button
          type="button"
          onClick={() => step(-1)}
          className="flex size-11 items-center justify-center rounded-full border border-(--t-control)"
          aria-label="Previous"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          className="flex size-11 items-center justify-center rounded-full border border-(--t-control)"
          aria-label="Next"
        >
          →
        </button>
      </div>
      <span
        ref={arrow}
        data-follower=""
        aria-hidden="true"
        className="absolute top-0 left-0 hidden size-7.5 items-center justify-center rounded-full bg-(--t-text) text-label-xs text-(--t-bg) group-data-follow:flex group-data-[side=start]:rotate-180"
      >
        →
      </span>
    </div>
  );
}
