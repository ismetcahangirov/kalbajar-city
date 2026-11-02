"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentPropsWithoutRef } from "react";

import { controlClass, describedBy, Field, type FieldProps } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { t } from "@/lib/admin/messages";
import { cx } from "@/lib/cx";

type PasswordInputProps = FieldProps & Omit<ComponentPropsWithoutRef<"input">, "id" | "type">;

/** A password field with a show/hide toggle, so a long password can be checked. */
export function PasswordInput({
  id,
  label,
  helper,
  error,
  required,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label} helper={helper} error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, helper, error)}
          className={cx(controlClass, "min-h-control pr-14")}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? t("field.hidePassword") : t("field.showPassword")}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex min-w-target items-center justify-center text-text-muted hover:text-text"
        >
          <Icon icon={visible ? EyeOff : Eye} />
        </button>
      </div>
    </Field>
  );
}
