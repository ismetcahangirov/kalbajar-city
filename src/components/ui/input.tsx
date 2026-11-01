import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

import { controlClass, describedBy, Field, type FieldProps } from "./field";

type InputProps = FieldProps & Omit<ComponentPropsWithoutRef<"input">, "id">;

export function Input({ id, label, helper, error, required, className, ...props }: InputProps) {
  return (
    <Field id={id} label={label} helper={helper} error={error} className={className}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, helper, error)}
        className={cx(controlClass, "min-h-control")}
        {...props}
      />
    </Field>
  );
}
