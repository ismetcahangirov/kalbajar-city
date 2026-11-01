import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

import { controlClass, describedBy, Field, type FieldProps } from "./field";

type TextareaProps = FieldProps & Omit<ComponentPropsWithoutRef<"textarea">, "id">;

export function Textarea({
  id,
  label,
  helper,
  error,
  required,
  className,
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <Field id={id} label={label} helper={helper} error={error} className={className}>
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, helper, error)}
        className={cx(controlClass, "min-h-control resize-y py-3")}
        {...props}
      />
    </Field>
  );
}
