"use client";

import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";

import { t } from "@/lib/admin/messages";

export type FocusPoint = { x: number; y: number };

/** The crops a page may make of an image: wide, square, portrait. */
const crops = [
  { ratio: "16 / 9", label: "16:9" },
  { ratio: "1 / 1", label: "1:1" },
  { ratio: "3 / 4", label: "3:4" },
] as const;

const clamp = (value: number) => Math.min(1, Math.max(0, Math.round(value * 1000) / 1000));
const percent = (value: number) => Math.round(value * 100);

const steps: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * The point a crop keeps in view (`object-position` on the site). Click or
 * tap the image to set it; the marker takes the arrow keys, 1 % a step and
 * 10 % with Shift. The three crops beside it show the result.
 */
export function FocusPicker({
  src,
  width,
  height,
  value,
  onChange,
}: {
  src: string;
  width: number;
  height: number;
  value: FocusPoint;
  onChange: (value: FocusPoint) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const position = `${percent(value.x)}% ${percent(value.y)}%`;

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    onChange({
      x: clamp((event.clientX - box.left) / box.width),
      y: clamp((event.clientY - box.top) / box.height),
    });
  };

  const nudge = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    const size = event.shiftKey ? 0.1 : 0.01;
    onChange({ x: clamp(value.x + step[0] * size), y: clamp(value.y + step[1] * size) });
  };

  return (
    <div className="flex flex-col gap-4">
      <p id={hintId} className="text-sm text-muted-foreground">
        {t("media.focusHint")}
      </p>
      <div
        ref={frame}
        data-focus-picker=""
        className="relative w-full max-w-xl cursor-crosshair touch-none self-start overflow-hidden rounded-md select-none"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerDown={(event) => {
          pick(event);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="size-full object-contain" />
        <button
          type="button"
          data-focus-handle=""
          aria-label={t("media.focusHandle", { x: percent(value.x), y: percent(value.y) })}
          aria-describedby={hintId}
          onKeyDown={nudge}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute flex size-(--spacing-target) -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
        >
          <span
            aria-hidden
            className="border-background bg-primary shadow-md size-6 rounded-full border-2"
          />
        </button>
      </div>
      <p className="text-sm" aria-live="polite">
        {t("media.focusValue", { x: percent(value.x), y: percent(value.y) })}
      </p>
      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-medium">{t("media.crops")}</figcaption>
        <div className="flex flex-wrap items-end gap-3">
          {crops.map((crop) => (
            <div key={crop.label} className="flex flex-col gap-1">
              <div
                className="bg-muted h-24 overflow-hidden rounded-sm"
                style={{ aspectRatio: crop.ratio }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="size-full object-cover"
                  style={{ objectPosition: position }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {t("media.crop", { ratio: crop.label })}
              </span>
            </div>
          ))}
        </div>
      </figure>
    </div>
  );
}
