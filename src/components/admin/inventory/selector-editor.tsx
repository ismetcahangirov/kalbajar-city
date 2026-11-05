"use client";

import { Check, Eraser, Save, Trash2, Undo2 } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { t, type MessageKey } from "@/lib/admin/messages";
import { cn } from "@/lib/admin/utils";
import {
  labelPoint,
  pictureCanvas,
  selectorPolygonSchema,
  toSvgPoints,
  type Canvas,
  type Point,
  type Polygon,
} from "@/shared/complex";
import type { AdminPlan } from "@/shared/inventory";
import type {
  AdminSelectorHotspot,
  AdminSelectorPicture,
  AdminSelectorView,
  SelectorLevel,
} from "@/shared/selector";
import { useBlocksQuery, useFloorsQuery } from "@/store/endpoints/admin-inventory";
import {
  useSelectorViewQuery,
  useSetSelectorHotspotMutation,
  useSetSelectorPictureMutation,
} from "@/store/endpoints/admin-selector";

import { MediaPicker } from "./media-picker";

const site = "site";
const facade = "facade";

/** What staff call a hotspot, by the level it is drawn on. */
function hotspotName(level: SelectorLevel, hotspot: AdminSelectorHotspot): string {
  const label = hotspot.label;
  if (level === "site") return t("selector.hotspot.block", { label });
  if (level === "block") return t("selector.hotspot.floor", { label });
  return t("selector.hotspot.apartment", { label });
}

/**
 * The complex selector's polygon editor (#19). Staff pick a level (the site,
 * a block's facade or a floor's plan), set its picture from the media
 * library, then draw each item's hotspot by clicking its corners on the
 * picture. Points are stored normalised (0–1), so the public selector scales
 * them to any size. The canvas also works by keyboard: the arrows move a
 * cursor, Enter adds a point, Backspace removes the last one.
 */
export function SelectorEditor({ canEdit }: { canEdit: boolean }) {
  const blockId = useId();
  const floorId = useId();
  const [block, setBlock] = useState(site);
  const [floor, setFloor] = useState(facade);
  const blocks = useBlocksQuery();
  const floors = useFloorsQuery({ block }, { skip: block === site });
  const query = block === site ? {} : floor === facade ? { block } : { block, floor };
  const view = useSelectorViewQuery(query);
  const currentBlock = blocks.data?.find((item) => item.id === block);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={blockId}>{t("selector.level")}</Label>
          <Select
            value={block}
            onValueChange={(value) => {
              setBlock(value);
              setFloor(facade);
            }}
          >
            <SelectTrigger id={blockId} className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={site}>{t("selector.site")}</SelectItem>
              {(blocks.data ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {t("selector.blockFacade", { code: item.code })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {currentBlock ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={floorId}>{t("selector.floor")}</Label>
            <Select value={floor} onValueChange={setFloor}>
              <SelectTrigger id={floorId} className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={facade}>{t("selector.facade")}</SelectItem>
                {(floors.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {t("selector.floorPlan", { floor: item.number })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {view.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-destructive">{apiErrorMessage(view.error)}</p>
          <Button type="button" variant="outline" onClick={() => view.refetch()}>
            {t("ui.retry")}
          </Button>
        </div>
      ) : !view.currentData ? (
        <Skeleton className="aspect-video w-full max-w-3xl" />
      ) : (
        // Keyed by level so a new level starts with no draft and no selection.
        <Level
          key={`${view.currentData.level}:${view.currentData.id ?? ""}`}
          view={view.currentData}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

function Level({ view, canEdit }: { view: AdminSelectorView; canEdit: boolean }) {
  const [setPicture, pictureState] = useSetSelectorPictureMutation();
  const [selected, setSelected] = useState<string | null>(null);
  const drawn = view.hotspots.filter((item) => item.polygon).length;
  const picture = view.picture;
  const hotspot = view.hotspots.find((item) => item.id === selected) ?? null;

  const choosePicture = async (next: AdminPlan | null) => {
    try {
      await setPicture({ level: view.level, id: view.id, mediaId: next?.id ?? null }).unwrap();
      toast.success(t("selector.pictureSaved"));
    } catch (error) {
      toastApiError(error);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        {canEdit ? (
          <MediaPicker
            label={t(`selector.picture.${view.level}`)}
            value={
              picture ? { id: picture.id, previewUrl: picture.previewUrl, alt: picture.alt } : null
            }
            onChange={(next) => {
              if (!pictureState.isLoading) void choosePicture(next);
            }}
          />
        ) : null}
        <p className="text-sm text-muted-foreground max-w-prose">{t("selector.pictureHint")}</p>
        {picture?.missingAlt ? (
          <p className="text-sm text-destructive">{t("selector.missingAlt")}</p>
        ) : null}
      </div>

      {view.hotspots.length ? (
        <p className="text-sm max-w-prose" data-testid="selector-progress">
          {t("selector.progress", { drawn, total: view.hotspots.length })}{" "}
          {t("selector.publicHint")}
        </p>
      ) : (
        <p className="rounded-md border border-dashed p-6">{t("selector.empty")}</p>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          {!picture ? (
            <p className="rounded-md border border-dashed p-6">{t("selector.noPicture")}</p>
          ) : !picture.url || !picture.width || !picture.height ? (
            <p className="rounded-md border border-dashed p-6">{t("selector.noSize")}</p>
          ) : (
            <DrawingCanvas
              key={hotspot?.id ?? "none"}
              level={view.level}
              picture={
                picture as AdminSelectorPicture & { url: string; width: number; height: number }
              }
              hotspots={view.hotspots}
              hotspot={hotspot}
              canEdit={canEdit}
            />
          )}
        </div>
        <HotspotList
          level={view.level}
          hotspots={view.hotspots}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </div>
  );
}

function HotspotList({
  level,
  hotspots,
  selected,
  onSelect,
}: {
  level: SelectorLevel;
  hotspots: AdminSelectorHotspot[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const id = useId();
  if (!hotspots.length) return null;
  return (
    <section
      aria-labelledby={id}
      // On a phone the list comes first, so the item is chosen before scrolling to the picture.
      className="order-first flex min-w-0 flex-col gap-2 lg:order-none"
    >
      <h2 id={id} className="text-lg font-medium">
        {t("selector.hotspots")}
      </h2>
      <ul className="flex flex-col gap-1">
        {hotspots.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-pressed={item.id === selected}
              onClick={() => onSelect(item.id)}
              className={cn(
                "text-sm flex min-h-target w-full flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left",
                item.id === selected && "border-primary border-2",
              )}
            >
              <span className="font-medium">{hotspotName(level, item)}</span>
              <span className="flex flex-wrap items-center gap-1">
                {item.status ? <Badge variant="outline">{t(`status.${item.status}`)}</Badge> : null}
                {item.polygon ? (
                  <Badge variant="secondary">
                    <Check aria-hidden />
                    {t("selector.drawn")}
                  </Badge>
                ) : (
                  <Badge variant="outline">{t("selector.notDrawn")}</Badge>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 10_000) / 10_000;
/** How far, in CSS pixels, a pointer may move and still count as a tap. */
const tapSlop = 6;

/** Why a draft is not a shape yet, from the first thing the schema refused. */
function draftProblem(code: string | undefined): MessageKey {
  if (code === "too_small") return "selector.tooFew";
  if (code === "too_big") return "selector.tooMany";
  return "selector.noArea";
}

function DrawingCanvas({
  level,
  picture,
  hotspots,
  hotspot,
  canEdit,
}: {
  level: SelectorLevel;
  picture: AdminSelectorPicture & { url: string; width: number; height: number };
  hotspots: AdminSelectorHotspot[];
  hotspot: AdminSelectorHotspot | null;
  canEdit: boolean;
}) {
  const hintId = useId();
  const [points, setPoints] = useState<Point[]>(() => [...(hotspot?.polygon ?? [])]);
  const [cursor, setCursor] = useState<Point>([0.5, 0.5]);
  const [keyboard, setKeyboard] = useState(false);
  const [save, saveState] = useSetSelectorHotspotMutation();
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const size: Canvas = pictureCanvas(picture);
  const editable = canEdit && hotspot !== null;

  const add = (point: Point) =>
    setPoints((current) => [...current, [round(point[0]), round(point[1])]]);
  const undo = () => setPoints((current) => current.slice(0, -1));

  // A point is a tap, not a swipe: the canvas lets a phone scroll the page,
  // so the point is added when the pointer lifts where it went down. A
  // scroll cancels the pointer and adds nothing.
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!editable || event.button !== 0) return;
    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const start = press.current;
    press.current = null;
    if (!editable || !start || start.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > tapSlop) return;
    const box = event.currentTarget.getBoundingClientRect();
    setKeyboard(false);
    add([
      clamp((event.clientX - box.left) / box.width),
      clamp((event.clientY - box.top) / box.height),
    ]);
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!editable) return;
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, Point> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setKeyboard(true);
      setCursor(([x, y]) => [round(clamp(x + move[0])), round(clamp(y + move[1]))]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setKeyboard(true);
      add(cursor);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      undo();
    }
  };

  const store = async (polygon: Polygon | null) => {
    if (!hotspot) return;
    try {
      await save({
        level,
        id: hotspot.id,
        polygon: polygon ? polygon.map(([x, y]): [number, number] => [x, y]) : null,
      }).unwrap();
      if (!polygon) setPoints([]);
      toast.success(polygon ? t("selector.saved") : t("selector.removed"));
    } catch (error) {
      toastApiError(error);
    }
  };

  const parsed = selectorPolygonSchema.safeParse(points);
  const name = hotspot ? hotspotName(level, hotspot) : null;
  const scale = size.width / 1000;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative w-full overflow-hidden rounded-md border">
        {/* The console shows the render as is; the public site sizes it itself. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={picture.url}
          alt={picture.alt ?? ""}
          width={picture.width}
          height={picture.height}
          className="block h-auto w-full select-none"
          draggable={false}
        />
        <svg
          viewBox={`0 0 ${size.width} ${size.height}`}
          className={cn(
            "focus-visible:outline-ring absolute inset-0 size-full touch-manipulation focus-visible:outline-2",
            editable && "cursor-crosshair",
          )}
          tabIndex={editable ? 0 : -1}
          role={editable ? "application" : "img"}
          aria-label={name ? t("selector.canvas", { name }) : t("selector.pickHotspot")}
          aria-describedby={editable ? hintId : undefined}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (press.current = null)}
          onKeyDown={onKeyDown}
          onFocus={() => setKeyboard(true)}
          onBlur={() => setKeyboard(false)}
          data-testid="selector-canvas"
        >
          {hotspots.map((item) =>
            item.polygon && item.id !== hotspot?.id ? (
              <g key={item.id} aria-hidden>
                <polygon
                  points={toSvgPoints(item.polygon, size)}
                  className="fill-background/40 stroke-foreground"
                  strokeWidth={2 * scale}
                />
                <text
                  {...labelPoint(item.polygon, size)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={24 * scale}
                  className="fill-foreground stroke-background font-medium"
                  strokeWidth={4 * scale}
                  paintOrder="stroke"
                >
                  {item.label}
                </text>
              </g>
            ) : null,
          )}
          {points.length ? (
            <g aria-hidden>
              <polygon
                points={toSvgPoints(points, size)}
                className="fill-primary/25 stroke-primary"
                strokeWidth={3 * scale}
                strokeDasharray={parsed.success ? undefined : `${8 * scale} ${6 * scale}`}
              />
              {points.map(([x, y], index) => (
                <circle
                  key={index}
                  cx={x * size.width}
                  cy={y * size.height}
                  r={6 * scale}
                  className="fill-background stroke-primary"
                  strokeWidth={3 * scale}
                />
              ))}
            </g>
          ) : null}
          {editable && keyboard ? (
            <g aria-hidden className="stroke-primary" strokeWidth={2 * scale}>
              <line
                x1={cursor[0] * size.width}
                x2={cursor[0] * size.width}
                y1={cursor[1] * size.height - 18 * scale}
                y2={cursor[1] * size.height + 18 * scale}
              />
              <line
                x1={cursor[0] * size.width - 18 * scale}
                x2={cursor[0] * size.width + 18 * scale}
                y1={cursor[1] * size.height}
                y2={cursor[1] * size.height}
              />
            </g>
          ) : null}
        </svg>
      </div>

      {editable ? (
        <>
          <p id={hintId} className="text-sm text-muted-foreground max-w-prose">
            {t("selector.canvasHint")}
          </p>
          <p className="text-sm" role="status" aria-live="polite">
            {name}: {t("selector.points", { count: points.length })}
            {points.length && !parsed.success
              ? ` · ${t(draftProblem(parsed.error.issues[0]?.code))}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!parsed.success || saveState.isLoading}
              onClick={() => parsed.success && void store(parsed.data)}
            >
              <Save aria-hidden />
              {t("selector.save")}
            </Button>
            <Button type="button" variant="outline" disabled={!points.length} onClick={undo}>
              <Undo2 aria-hidden />
              {t("selector.undo")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!points.length}
              onClick={() => setPoints([])}
            >
              <Eraser aria-hidden />
              {t("selector.clear")}
            </Button>
            {hotspot?.polygon ? (
              <Button
                type="button"
                variant="ghost"
                disabled={saveState.isLoading}
                onClick={() => void store(null)}
              >
                <Trash2 aria-hidden />
                {t("selector.remove")}
              </Button>
            ) : null}
          </div>
        </>
      ) : canEdit ? (
        <p className="text-sm text-muted-foreground">{t("selector.pickHotspot")}</p>
      ) : null}
    </div>
  );
}
