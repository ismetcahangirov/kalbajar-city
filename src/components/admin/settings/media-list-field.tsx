"use client";

import { useState } from "react";
import {
  useFieldArray,
  useWatch,
  type ArrayPath,
  type Control,
  type FieldArray,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { MediaPicker } from "@/components/admin/media/media-picker";

import { ListEditor } from "./list-editor";
import { MediaField } from "./media-field";

/**
 * An ordered list of images, stored in the form as `{ mediaId }` rows. "Add"
 * opens the library first, so a row never exists without its image and a save
 * can never fail on an empty row nobody can see. `renderExtra` adds a row's
 * own fields, such as a caption.
 */
export function MediaListField<T extends FieldValues>({
  name,
  control,
  legend,
  description,
  itemLabel,
  addLabel,
  emptyText,
  imageLabel,
  max,
  disabled = false,
  canUpload = false,
  newRow,
  renderExtra,
}: {
  name: ArrayPath<T>;
  control: Control<T, unknown, unknown>;
  legend: string;
  description?: string;
  itemLabel: (index: number) => string;
  addLabel: string;
  emptyText: string;
  /** The picker's label in a row; the row's own label when left out. */
  imageLabel?: string;
  max: number;
  disabled?: boolean;
  canUpload?: boolean;
  /** The rest of a new row, next to its `mediaId`. */
  newRow?: Record<string, unknown>;
  renderExtra?: (index: number) => React.ReactNode;
}) {
  const rows = useFieldArray({ control, name });
  const values = useWatch({ control, name: name as unknown as Path<T> }) as
    Array<{ mediaId?: string }> | undefined;
  const [picking, setPicking] = useState(false);

  return (
    <>
      <ListEditor
        legend={legend}
        description={description}
        ids={rows.fields.map((field) => field.id)}
        itemLabel={itemLabel}
        renderItem={(index) => (
          <>
            <MediaField
              label={imageLabel ?? itemLabel(index)}
              value={values?.[index]?.mediaId ?? null}
              disabled={disabled}
              canUpload={canUpload}
              clearable={false}
              onChange={(mediaId) => {
                if (!mediaId) return;
                rows.update(index, {
                  ...values?.[index],
                  mediaId,
                } as unknown as FieldArray<T, ArrayPath<T>>);
              }}
            />
            {renderExtra?.(index)}
          </>
        )}
        onMove={rows.move}
        onRemove={rows.remove}
        onAdd={() => setPicking(true)}
        addLabel={addLabel}
        emptyText={emptyText}
        max={max}
        disabled={disabled}
      />
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        kind="image"
        title={addLabel}
        canUpload={canUpload}
        exclude={(values ?? []).flatMap((row) => row.mediaId ?? [])}
        onSelect={(picked) =>
          rows.append({ mediaId: picked.id, ...newRow } as unknown as FieldArray<T, ArrayPath<T>>)
        }
      />
    </>
  );
}
