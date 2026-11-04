import { CircleAlert } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * The hairline form box (ui-kit.md → FieldBox): fields in one bordered box,
 * two columns side by side where the form is wide enough (`columns={2}`),
 * divided by 1 px lines in `--t-control`. Every state is instant: forms
 * never animate. Reads the theme tokens, so it works on sand and light.
 */
export function FieldBox({
  columns = 1,
  children,
  className,
}: {
  columns?: 1 | 2;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid gap-px border border-(--t-control) bg-(--t-control)",
        columns === 2 && "@lg:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Common = {
  id: string;
  label: string;
  /** Sets `aria-invalid`; the message is a `FieldNote` with id `${id}-error`. */
  error?: string;
  /** A `FieldNote` with id `${id}-helper`. */
  helper?: string;
};

type InputCell = Common &
  Omit<ComponentPropsWithoutRef<"input">, "id" | "placeholder"> & {
    multiline?: false;
  };
type TextareaCell = Common &
  Omit<ComponentPropsWithoutRef<"textarea">, "id" | "placeholder"> & {
    multiline: true;
  };

function describedBy(id: string, error?: string, helper?: string): string | undefined {
  const ids = [error && `${id}-error`, helper && `${id}-helper`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/**
 * One 70 px cell (60 px on phones) of a `FieldBox`: the input with its label
 * floating to the top once the field has focus or a value. Hover and focus
 * draw the cell's edge in the text colour, an error in `--color-error`.
 */
export function FieldBoxInput(props: InputCell | TextareaCell) {
  const { id, label, error, helper, className } = props;
  const shared = {
    id,
    placeholder: " ",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(id, error, helper),
    className: "field-box__control",
  } as const;
  const fixedLabel = !props.multiline && props.type === "datetime-local";
  return (
    <div
      data-invalid={error ? "" : undefined}
      className={cx(
        "field-box relative bg-(--t-bg)",
        props.multiline && "@lg:col-span-full",
        className,
      )}
    >
      {props.multiline ? (
        <textarea
          {...omitCommon(props)}
          {...shared}
          rows={4}
          className="field-box__control field-box__control--multiline"
        />
      ) : (
        <input {...omitCommon(props)} {...shared} />
      )}
      <label
        htmlFor={id}
        className={cx("field-box__label", fixedLabel && "field-box__label--fixed")}
      >
        {label}
      </label>
    </div>
  );
}

function omitCommon<T extends Common & { multiline?: boolean; className?: string }>(props: T) {
  const rest: Record<string, unknown> = { ...props };
  for (const key of ["id", "label", "error", "helper", "multiline", "className"]) delete rest[key];
  return rest as Omit<T, keyof Common | "multiline" | "className">;
}

/**
 * A field's error or helper under the box. On sand the error colour fails
 * as text, so it marks the icon and the cell's edge; the words stay in the
 * text colour (ui-kit.md → Themes).
 */
export function FieldNote({
  id,
  tone = "helper",
  children,
}: {
  id: string;
  tone?: "helper" | "error";
  children: ReactNode;
}) {
  return (
    <p id={id} className="flex items-start gap-2 text-small-t text-(--t-text)">
      {tone === "error" && (
        <CircleAlert
          width={16}
          height={16}
          strokeWidth={1.5}
          aria-hidden
          focusable={false}
          className="mt-px shrink-0 text-error"
        />
      )}
      <span>{children}</span>
    </p>
  );
}
