"use client";

import { Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { Icon } from "@/components/ui/icon";
import { Picture } from "@/components/ui/picture";
import { formatPercent } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import type { PublicImage } from "@/lib/public/media";

type View = { scale: number; x: number; y: number };

const initial: View = { scale: 1, x: 0, y: 0 };
const minScale = 1;
const maxScale = 6;
const step = 1.25;
const panStep = 48;

const FOCUSABLE = "button:not([disabled])";

const toolButton = cx(
  "grid size-target shrink-0 place-items-center rounded-full text-text hover:bg-surface-alt",
  "disabled:opacity-(--opacity-disabled)",
);

/**
 * The floor plan, and a full-screen dialog that shows it at full resolution
 * with zoom and pan: pinch and drag (pointer events), the wheel, and the
 * keyboard (+, −, 0, arrows; Escape closes). Only CSS `transform` changes and
 * nothing animates: the plan is a document, not a scene (motion-system.md →
 * budget, "anything on the plan").
 */
export function PlanViewer({
  image,
  name,
  locale,
  priority = true,
}: {
  image: PublicImage;
  /** The apartment's name, for the dialog's title. */
  name: string;
  locale: Locale;
  /** The first plan on the page loads eagerly; one in a hidden tab does not. */
  priority?: boolean;
}) {
  const t = useTranslations("ApartmentPage");
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const plan = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(initial);
  const current = useRef(view);
  const titleId = useId();
  const hintId = useId();

  /** Keeps the scale in range and the plan's edges from leaving the stage. */
  const commit = useCallback((next: View) => {
    const box = stage.current?.getBoundingClientRect();
    const img = plan.current;
    const scale = Math.min(maxScale, Math.max(minScale, next.scale));
    let { x, y } = next;
    if (box && img) {
      const limitX = Math.max(0, (img.offsetWidth * scale - box.width) / 2);
      const limitY = Math.max(0, (img.offsetHeight * scale - box.height) / 2);
      x = Math.min(limitX, Math.max(-limitX, x));
      y = Math.min(limitY, Math.max(-limitY, y));
    }
    const view = scale === 1 ? initial : { scale, x, y };
    current.current = view;
    setView(view);
  }, []);

  /** Zooms by `factor`, keeping the point under (clientX, clientY) in place. */
  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const box = stage.current?.getBoundingClientRect();
      const { scale, x, y } = current.current;
      const next = Math.min(maxScale, Math.max(minScale, scale * factor));
      if (!box) return commit({ ...current.current, scale: next });
      const px = (clientX ?? box.left + box.width / 2) - (box.left + box.width / 2);
      const py = (clientY ?? box.top + box.height / 2) - (box.top + box.height / 2);
      const ratio = next / scale;
      commit({ scale: next, x: px - ratio * (px - x), y: py - ratio * (py - y) });
    },
    [commit],
  );

  // React's wheel listener is passive, so it cannot stop the page scrolling.
  useEffect(() => {
    const element = stage.current;
    if (!element || !open) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(Math.exp(-event.deltaY / 400), event.clientX, event.clientY);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [open, zoomAt]);

  function show() {
    dialog.current?.showModal();
    setOpen(true);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const map = pointers.current;
    const last = map.get(event.pointerId);
    if (!last) return;
    const point = { x: event.clientX, y: event.clientY };
    if (map.size === 1) {
      const { x, y } = current.current;
      commit({ ...current.current, x: x + point.x - last.x, y: y + point.y - last.y });
    } else if (map.size === 2) {
      const other = [...map.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(last.x - other.x, last.y - other.y);
        const after = Math.hypot(point.x - other.x, point.y - other.y);
        if (before > 0) {
          zoomAt(after / before, (point.x + other.x) / 2, (point.y + other.y) / 2);
        }
      }
    }
    map.set(event.pointerId, point);
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    const { x, y } = current.current;
    switch (event.key) {
      case "+":
      case "=":
        zoomAt(step);
        break;
      case "-":
      case "_":
        zoomAt(1 / step);
        break;
      case "0":
        commit(initial);
        break;
      case "ArrowLeft":
        commit({ ...current.current, x: x + panStep });
        break;
      case "ArrowRight":
        commit({ ...current.current, x: x - panStep });
        break;
      case "ArrowUp":
        commit({ ...current.current, y: y + panStep });
        break;
      case "ArrowDown":
        commit({ ...current.current, y: y - panStep });
        break;
      case "Tab": {
        // A modal dialog alone lets focus leave for the browser's toolbar.
        const stops = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const first = stops[0];
        const last = stops.at(-1);
        const edge = event.shiftKey ? first : last;
        if (first && last && document.activeElement === edge) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
        return;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-label={t("planOpen")}
        className="group relative block w-full overflow-hidden rounded-md bg-surface-raised"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        <Picture image={image} sizes="(min-width: 64rem) 60vw, 100vw" priority={priority} />
        <span
          aria-hidden
          data-print-hidden=""
          className="absolute end-3 top-3 inline-flex min-h-target items-center gap-2 rounded-full bg-surface-raised px-4 text-small font-medium text-text shadow-raised"
        >
          <Icon icon={Maximize2} />
          {t("planOpen")}
        </span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={hintId}
        data-scroll-lock=""
        data-lenis-prevent=""
        onKeyDown={onKeyDown}
        onClose={() => {
          setOpen(false);
          commit(initial);
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-surface-raised p-0 text-text backdrop:bg-transparent"
      >
        <div className="flex h-full flex-col">
          <div className="flex min-h-(--header-height) flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-2 px-page">
            <h2 id={titleId} className="min-w-0 text-legacy-title">
              {t("planDialog", { name })}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={toolButton}
                onClick={() => zoomAt(1 / step)}
                disabled={view.scale <= minScale}
                aria-label={t("zoomOut")}
              >
                <Icon icon={Minus} />
              </button>
              <output
                aria-live="polite"
                className="min-w-14 text-center text-small text-text-muted"
              >
                <span className="sr-only">
                  {t("zoomLevel", { percent: formatPercent(view.scale * 100, locale) })}
                </span>
                <span aria-hidden>{formatPercent(view.scale * 100, locale)}</span>
              </output>
              <button
                type="button"
                className={toolButton}
                onClick={() => zoomAt(step)}
                disabled={view.scale >= maxScale}
                aria-label={t("zoomIn")}
              >
                <Icon icon={Plus} />
              </button>
              <button
                type="button"
                className={toolButton}
                onClick={() => commit(initial)}
                aria-label={t("zoomReset")}
              >
                <Icon icon={RotateCcw} />
              </button>
              <button
                type="button"
                autoFocus
                className={toolButton}
                onClick={() => dialog.current?.close()}
                aria-label={t("zoomClose")}
              >
                <Icon icon={X} size={24} />
              </button>
            </div>
          </div>
          <div
            ref={stage}
            className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <div className="absolute inset-0 flex items-center justify-center p-4">
              {open && (
                // The widest variants: the plan is meant to be zoomed into.
                <picture className="contents">
                  {image.sources.map((source) => (
                    <source
                      key={source.type}
                      type={source.type}
                      srcSet={source.srcSet}
                      sizes="200vw"
                    />
                  ))}
                  <img
                    ref={plan}
                    src={image.src}
                    width={image.width}
                    height={image.height}
                    alt={image.alt}
                    draggable={false}
                    className="h-auto max-h-full w-auto max-w-full object-contain"
                    style={{
                      transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                    }}
                  />
                </picture>
              )}
            </div>
          </div>
          <p id={hintId} className="border-t border-border py-3 px-page text-small text-text-muted">
            {t("zoomHint")}
          </p>
        </div>
      </dialog>
    </>
  );
}
