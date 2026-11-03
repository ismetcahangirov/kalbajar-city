"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/admin/ui/button";
import { t } from "@/lib/admin/messages";
import { cn } from "@/lib/admin/utils";
import { move } from "@/shared/ordering";

type Item = { id: string };

/**
 * A list put in order by dragging (#25: FAQ, gallery). Three ways to move a
 * row, so nobody depends on a drag (WCAG 2.2, 2.5.7):
 * - drag the handle with a mouse or a finger;
 * - focus the handle, press Space, move with the arrow keys, Space to drop
 *   (Escape cancels), announced in Azerbaijani;
 * - the up and down buttons, one step at a time.
 * `onReorder` gets every id in the new order; the parent saves it.
 */
export function SortableList<T extends Item>({
  items,
  label,
  itemName,
  onReorder,
  renderItem,
  disabled = false,
  className,
}: {
  items: readonly T[];
  /** The list's accessible name. */
  label: string;
  /** The row's name in buttons and announcements. */
  itemName: (item: T) => string;
  onReorder: (ids: string[]) => void;
  renderItem: (item: T) => ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(
    // A short distance first, so a tap on the handle is not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  const nameOf = (id: UniqueIdentifier) => {
    const item = items.find((candidate) => candidate.id === id);
    return item ? itemName(item) : "";
  };
  const position = (id: UniqueIdentifier | undefined) =>
    id === undefined ? 0 : ids.indexOf(String(id)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("sortable.picked", {
        item: nameOf(active.id),
        position: position(active.id),
        total: ids.length,
      }),
    onDragOver: ({ active, over }) =>
      over
        ? t("list.moved", {
            item: nameOf(active.id),
            position: position(over.id),
            total: ids.length,
          })
        : t("sortable.outside", { item: nameOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? t("sortable.dropped", {
            item: nameOf(active.id),
            position: position(over.id),
            total: ids.length,
          })
        : t("sortable.cancelled", { item: nameOf(active.id) }),
    onDragCancel: ({ active }) => t("sortable.cancelled", { item: nameOf(active.id) }),
  };

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= ids.length) return;
    onReorder(move(ids, from, to));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    reorder(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };

  /** Up and down buttons: focus stays on the moved row's button, and a live region says where. */
  const step = (index: number, direction: "up" | "down") => {
    const item = items[index];
    if (!item) return;
    const to = direction === "up" ? index - 1 : index + 1;
    reorder(index, to);
    setAnnouncement(t("list.moved", { item: itemName(item), position: to + 1, total: ids.length }));
    requestAnimationFrame(() => {
      const row = list.current?.querySelector(`[data-sortable-id="${item.id}"]`);
      const target =
        row?.querySelector<HTMLElement>(`[data-sortable-action="${direction}"]:not(:disabled)`) ??
        row?.querySelector<HTMLElement>("[data-sortable-action]:not(:disabled)");
      target?.focus();
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("sortable.instructions") },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol ref={list} aria-label={label} className={cn("flex min-w-0 flex-col gap-2", className)}>
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              id={item.id}
              name={itemName(item)}
              disabled={disabled}
              first={index === 0}
              last={index === items.length - 1}
              onStep={(direction) => step(index, direction)}
            >
              {renderItem(item)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </DndContext>
  );
}

function SortableRow({
  id,
  name,
  disabled,
  first,
  last,
  onStep,
  children,
}: {
  id: string;
  name: string;
  disabled: boolean;
  first: boolean;
  last: boolean;
  onStep: (direction: "up" | "down") => void;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled, attributes: { roleDescription: t("sortable.role") } });

  return (
    <li
      ref={setNodeRef}
      data-sortable-id={id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card flex min-w-0 items-start gap-1 rounded-lg border p-2",
        isDragging && "shadow-md relative z-10",
      )}
    >
      <div className="flex shrink-0 flex-col items-center">
        <Button
          ref={setActivatorNodeRef}
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={t("sortable.handle", { item: name })}
        >
          <GripVertical aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-sortable-action="up"
          disabled={disabled || first}
          aria-label={t("list.moveUp", { item: name })}
          onClick={() => onStep("up")}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-sortable-action="down"
          disabled={disabled || last}
          aria-label={t("list.moveDown", { item: name })}
          onClick={() => onStep("down")}
        >
          <ArrowDown aria-hidden />
        </Button>
      </div>
      <div className="min-w-0 flex-1 p-1">{children}</div>
    </li>
  );
}
