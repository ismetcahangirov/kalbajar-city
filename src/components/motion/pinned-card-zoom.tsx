"use client";

import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { isBelowViewport, onReducedMotion, prefersReducedMotion } from "@/lib/motion/env";
import { documentTop, onMeasure, onScrollFrame } from "@/lib/motion/frame";
import { pinnedScenes, type Inset } from "@/lib/motion/pinned";

export type PinnedScene = {
  key: string;
  /** Fills the scene: an image or video, cropped with `object-fit: cover`. */
  media: ReactNode;
  caption: ReactNode;
};

type PinnedCardZoomProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  scenes: PinnedScene[];
};

const none: Inset = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The page's one pinned moment: a full-bleed scene holds a framed card with
 * the next scene in it, and scrolling grows the card until it is the scene.
 *
 * The server renders a plain list of scenes, which is also what visitors get
 * with reduced motion or without JavaScript. With motion, the section becomes
 * a tall track with a sticky stage (CSS, no pin library), and the scroll
 * position drives clip-path and opacity only (src/lib/motion/pinned.ts).
 */
export function PinnedCardZoom({ scenes, style, ...props }: PinnedCardZoomProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = ref.current;
    const stage = section?.querySelector<HTMLElement>("[data-pinned-stage]");
    if (!section || !stage || prefersReducedMotion() || !isBelowViewport(section)) return;

    const items = [...section.querySelectorAll<HTMLElement>("[data-scene]")];
    if (items.length < 2) return;
    const layers = items.map((item) => item.querySelector<HTMLElement>("[data-scene-layer]"));
    const cards = items.map((item) => item.querySelector<HTMLElement>("[data-scene-card]"));
    const captions = items.map((item) => item.querySelector<HTMLElement>("[data-scene-caption]"));

    section.dataset.pinned = "";
    // Captions sit on the image as dark panels while pinned.
    for (const caption of captions) caption?.setAttribute("data-tone", "night");

    let top = 0;
    let range = 0;
    let card = none;
    const applied = new Map<HTMLElement, Partial<Record<"clipPath" | "opacity", string>>>();
    // Writes a style only when it changed, so a scroll frame touches little.
    const set = (element: HTMLElement | null, property: "clipPath" | "opacity", value: string) => {
      if (!element) return;
      const previous = applied.get(element) ?? {};
      if (previous[property] === value) return;
      element.style[property] = value;
      applied.set(element, { ...previous, [property]: value });
    };

    const stopMeasure = onMeasure(() => {
      top = documentTop(section);
      range = section.offsetHeight - stage.offsetHeight;
      const box = stage.getBoundingClientRect();
      const rect = cards[1]?.getBoundingClientRect();
      if (!rect || box.width === 0 || box.height === 0) return;
      card = {
        top: ((rect.top - box.top) / box.height) * 100,
        right: ((box.right - rect.right) / box.width) * 100,
        bottom: ((box.bottom - rect.bottom) / box.height) * 100,
        left: ((rect.left - box.left) / box.width) * 100,
      };
    });

    const stopScroll = onScrollFrame((scrollY) => {
      const progress = range > 0 ? (scrollY - top) / range : 0;
      pinnedScenes(progress, items.length, card).forEach((state, k) => {
        const { clip, radius } = state;
        const inset = `inset(${clip.top.toFixed(3)}% ${clip.right.toFixed(3)}% ${clip.bottom.toFixed(3)}% ${clip.left.toFixed(3)}% round ${radius.toFixed(2)}px)`;
        if (k > 0) set(layers[k] ?? null, "clipPath", inset);
        set(layers[k] ?? null, "opacity", state.layerOpacity.toFixed(3));
        set(cards[k] ?? null, "opacity", state.frameOpacity.toFixed(3));
        set(captions[k] ?? null, "opacity", state.captionOpacity.toFixed(3));
      });
    });

    const stop = () => {
      stopMeasure();
      stopScroll();
      delete section.dataset.pinned;
      applied.clear();
      for (const element of [...layers, ...cards, ...captions]) {
        element?.style.removeProperty("clip-path");
        element?.style.removeProperty("opacity");
      }
      for (const caption of captions) caption?.removeAttribute("data-tone");
    };
    const stopReduced = onReducedMotion(stop);
    return () => {
      stopReduced();
      stop();
    };
  }, [scenes.length]);

  return (
    <section
      ref={ref}
      data-motion="pinned"
      style={{ ...style, "--scene-count": scenes.length } as CSSProperties}
      {...props}
    >
      <div data-pinned-stage="">
        <ol data-pinned-list="">
          {scenes.map((scene, i) => (
            <li key={scene.key} data-scene="">
              <div data-scene-layer="">{scene.media}</div>
              {i > 0 && (
                <div data-scene-card="" aria-hidden="true">
                  <div data-scene-frame="" />
                </div>
              )}
              <div data-scene-caption="">{scene.caption}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
