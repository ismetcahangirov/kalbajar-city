import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";

import { controlClass, describedBy, Field, type FieldProps } from "./field";
import { Icon } from "./icon";

type SelectProps = FieldProps & Omit<ComponentPropsWithoutRef<"select">, "id">;

/** Native select, so keyboards, screen readers and phones behave as expected. */
export function Select({
  id,
  label,
  helper,
  error,
  required,
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <Field id={id} label={label} helper={helper} error={error} className={className}>
      <div className="relative">
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, helper, error)}
          className={cx(controlClass, "min-h-control appearance-none pe-12")}
          {...props}
        >
          {children}
        </select>
        <Icon
          icon={ChevronDown}
          className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
      </div>
    </Field>
  );
}
