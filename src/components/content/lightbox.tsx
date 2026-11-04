"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Picture } from "@/components/ui/picture";
import type { Localized } from "@/i18n/content";
import { prefersReducedMotion } from "@/lib/motion/env";
import { cx } from "@/lib/cx";
import type { PublicImage } from "@/lib/public/media";

export type LightboxItem = { id: string; image: PublicImage; caption: Localized | null };

type LightboxProps = {
  items: LightboxItem[];
  /** `masonry`: CSS columns at each image's own ratio (the gallery). `grid`: 4 : 3 tiles. */
  layout: "masonry" | "grid";
  /** `sizes` of one thumbnail. */
  sizes: string;
  /** Columns of the `grid` layout from `lg`: 3, or 2 in a half-width column. */
  columns?: 2 | 3;
  className?: string;
};

const FOCUSABLE = "button:not([disabled])";

/** How far a swipe must travel, in CSS pixels, to change the image. */
const swipeDistance = 48;

const control =
  "grid size-target shrink-0 place-items-center rounded-full bg-surface text-text hover:bg-surface-alt";

/**
 * Thumbnails that open a full-screen viewer (#21): a native modal `<dialog>`
 * on `night`, so the page behind is inert and Escape closes it. Arrow keys,
 * Home and End, the buttons and a horizontal swipe move between images; the
 * position ("image 3 of 12") and the caption are announced in a live region;
 * closing returns focus to the thumbnail that opened it. Only `transform`
 * and `opacity` move, and nothing does under reduced motion.
 *
 * Without JavaScript the thumbnails are an ordinary image grid.
 */
export function Lightbox({ items, layout, sizes, columns = 3, className }: LightboxProps) {
  const t = useTranslations("Lightbox");
  const media = useTranslations("Media");
  const dialog = useRef<HTMLDialogElement>(null);
  const slide = useRef<HTMLDivElement>(null);
  const thumbnails = useRef<Array<HTMLButtonElement | null>>([]);
  const opener = useRef(0);
  const drag = useRef<{ id: number; x: number; y: number; dx: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const total = items.length;
  const current = items[index];

  function name(item: LightboxItem, i: number): string {
    return item.image.alt || item.caption?.value || t("untitled", { index: String(i + 1) });
  }

  /**
   * Shows image `i` and announces its position and caption. The live region
   * changes after the dialog is shown (state commits after the handler), so
   * screen readers hear it on opening as well as on every move.
   */
  function show(i: number) {
    const item = items[i];
    if (!item) return;
    setIndex(i);
    const position = t("position", { index: String(i + 1), total: String(total) });
    setAnnouncement(item.caption ? `${position}. ${item.caption.value}` : position);
  }

  function open(i: number) {
    opener.current = i;
    dialog.current?.showModal();
    show(i);
  }

  function go(next: number) {
    show(((next % total) + total) % total);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: total - 1,
    };
    const target = moves[event.key];
    if (target !== undefined) {
      event.preventDefault();
      go(target);
      return;
    }
    // A modal dialog alone lets Tab leave for the browser's toolbar; wrap it.
    if (event.key !== "Tab") return;
    const stops = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = stops[0];
    const last = stops.at(-1);
    if (!first || !last) return;
    if (document.activeElement === (event.shiftKey ? first : last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.target as Element).closest("button")) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    state.dx = event.clientX - state.x;
    // The image follows the finger; under reduced motion it stays put.
    if (slide.current && !prefersReducedMotion()) slide.current.style.translate = `${state.dx}px 0`;
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    if (slide.current) slide.current.style.translate = "";
    const dy = event.clientY - state.y;
    if (event.type === "pointercancel") return;
    if (Math.abs(state.dx) >= swipeDistance && Math.abs(state.dx) > Math.abs(dy)) {
      go(state.dx < 0 ? index + 1 : index - 1);
    }
  }

  return (
    <>
      <ul
        className={cx(
          layout === "masonry"
            ? "columns-1 gap-u2 sm:columns-2 lg:columns-3"
            : cx("grid gap-u sm:grid-cols-2", columns === 3 && "lg:grid-cols-3"),
          className,
        )}
      >
        {items.map((item, i) => (
          <li
            key={item.id}
            className={cx("relative", layout === "masonry" && "mb-u2 break-inside-avoid")}
          >
            <Reveal kind="image-in">
              <div
                className={cx("relative bg-(--t-line)", layout === "grid" && "aspect-grid")}
                style={
                  layout === "masonry"
                    ? { aspectRatio: `${item.image.width} / ${item.image.height}` }
                    : undefined
                }
              >
                <Picture image={item.image} sizes={sizes} />
              </div>
            </Reveal>
            <button
              type="button"
              ref={(element) => {
                thumbnails.current[i] = element;
              }}
              onClick={() => open(i)}
              aria-label={t("open", { name: name(item, i) })}
              aria-haspopup="dialog"
              className="absolute inset-0 cursor-zoom-in rounded-md"
            />
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        data-tone="night"
        data-lightbox=""
        aria-label={t("dialog")}
        onKeyDown={onKeyDown}
        onClose={() => {
          setAnnouncement("");
          thumbnails.current[opener.current]?.focus();
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 p-0 text-text backdrop:bg-transparent"
      >
        {current && (
          <figure className="flex h-full flex-col">
            <div className="flex h-(--header-height) shrink-0 items-center justify-between gap-4 px-page">
              <p aria-hidden className="text-small text-text-muted">
                {index + 1} / {total}
              </p>
              <button
                type="button"
                autoFocus
                onClick={() => dialog.current?.close()}
                aria-label={t("close")}
                className={control}
              >
                <Icon icon={X} size={24} />
              </button>
            </div>

            <div
              className="relative min-h-0 flex-1 touch-pan-y select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            >
              <div
                ref={slide}
                data-lightbox-slide=""
                className="absolute inset-0 px-page [&_img]:pointer-events-none"
              >
                <Picture key={current.id} image={current.image} sizes="100vw" fit="contain" />
              </div>
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(index - 1)}
                    aria-label={t("previous")}
                    className={cx(control, "absolute start-2 top-1/2 -translate-y-1/2 lg:start-6")}
                  >
                    <Icon icon={ChevronLeft} size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    aria-label={t("next")}
                    className={cx(control, "absolute end-2 top-1/2 -translate-y-1/2 lg:end-6")}
                  >
                    <Icon icon={ChevronRight} size={24} />
                  </button>
                </>
              )}
            </div>

            <figcaption className="flex min-h-(--header-height) shrink-0 flex-wrap items-center gap-x-4 gap-y-2 py-4 px-page">
              {current.image.illustrative && (
                <Badge variant="illustrative">{media("illustrative")}</Badge>
              )}
              {current.caption && (
                <span
                  className="text-body text-text-muted"
                  lang={current.caption.fallback ? current.caption.locale : undefined}
                >
                  {current.caption.value}
                </span>
              )}
            </figcaption>
          </figure>
        )}
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </p>
      </dialog>
    </>
  );
}
