"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/admin/ui/button";
import { t } from "@/lib/admin/messages";

type Direction = "up" | "down";

/**
 * An ordered list a form edits (#27: amenities, distances, phones): each
 * item with its own fields, moved with up/down buttons and removed with a
 * third, all by keyboard. Focus follows the moved item, and a polite live
 * region says where it went; a removed item hands focus to its neighbour.
 */
export function ListEditor({
  legend,
  description,
  ids,
  itemLabel,
  renderItem,
  onMove,
  onRemove,
  onAdd,
  addLabel,
  emptyText,
  min = 0,
  max = Infinity,
  disabled = false,
}: {
  legend: string;
  description?: string;
  /** One stable id per item (`useFieldArray`'s `fields[i].id`). */
  ids: readonly string[];
  /** The item's name for buttons and announcements, e.g. "Məsafə 2". */
  itemLabel: (index: number) => string;
  renderItem: (index: number) => ReactNode;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  addLabel: string;
  emptyText: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const list = useRef<HTMLOListElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState("");

  /** After React has rendered the change, focus `selector` inside item `index`. */
  const focusLater = (index: number, selectors: string[]) => {
    requestAnimationFrame(() => {
      const item = list.current?.querySelector(`[data-list-index="${index}"]`);
      for (const selector of selectors) {
        const target = item?.querySelector<HTMLElement>(selector);
        if (target) return target.focus();
      }
      add.current?.focus();
    });
  };

  const move = (index: number, direction: Direction) => {
    const to = direction === "up" ? index - 1 : index + 1;
    const label = itemLabel(index);
    onMove(index, to);
    setAnnouncement(t("list.moved", { item: label, position: to + 1, total: ids.length }));
    focusLater(to, [
      `[data-list-action="${direction}"]:not(:disabled)`,
      `[data-list-action]:not(:disabled)`,
    ]);
  };

  const remove = (index: number) => {
    const label = itemLabel(index);
    onRemove(index);
    setAnnouncement(t("list.removed", { item: label }));
    const next = index < ids.length - 1 ? index : index - 1;
    if (next >= 0) focusLater(next, ['[data-list-action="remove"]:not(:disabled)']);
    else requestAnimationFrame(() => add.current?.focus());
  };

  const append = () => {
    onAdd();
    focusLater(ids.length, ["input, textarea, [role=combobox]"]);
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="text-sm mb-2 font-medium">{legend}</legend>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {ids.length ? (
        <ol ref={list} className="flex flex-col gap-3">
          {ids.map((id, index) => {
            const label = itemLabel(index);
            return (
              <li
                key={id}
                data-list-index={index}
                aria-label={label}
                className="bg-card flex min-w-0 flex-col gap-4 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{label}</h3>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      data-list-action="up"
                      disabled={disabled || index === 0}
                      aria-label={t("list.moveUp", { item: label })}
                      onClick={() => move(index, "up")}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      data-list-action="down"
                      disabled={disabled || index === ids.length - 1}
                      aria-label={t("list.moveDown", { item: label })}
                      onClick={() => move(index, "down")}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      data-list-action="remove"
                      disabled={disabled || ids.length <= min}
                      aria-label={t("list.remove", { item: label })}
                      onClick={() => remove(index)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
                {renderItem(index)}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
      <Button
        ref={add}
        type="button"
        variant="outline"
        className="self-start"
        disabled={disabled || ids.length >= max}
        onClick={append}
      >
        <Plus aria-hidden />
        {addLabel}
      </Button>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </fieldset>
  );
}
