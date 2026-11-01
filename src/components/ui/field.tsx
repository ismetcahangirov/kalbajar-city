import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import { Icon } from "./icon";

export type FieldProps = {
  id: string;
  label: string;
  helper?: string;
  /** Error message. Sets `aria-invalid` and is announced with the field. */
  error?: string;
  required?: boolean;
};

export function describedBy(id: string, helper?: string, error?: string): string | undefined {
  const ids = [error ? `${id}-error` : null, helper ? `${id}-helper` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export const controlClass = cx(
  "w-full rounded-sm border border-border-strong bg-surface-raised px-4 text-body text-text",
  "placeholder:text-text-muted",
  "aria-invalid:border-2 aria-invalid:border-error",
  "disabled:opacity-(--opacity-disabled)",
);

/** Label above, helper or error below. Forms never animate. */
export function Field({
  id,
  label,
  helper,
  error,
  children,
  className,
}: Omit<FieldProps, "required"> & { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-small font-medium text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-2 text-small text-error">
          <Icon icon={CircleAlert} />
          <span>{error}</span>
        </p>
      ) : null}
      {helper ? (
        <p id={`${id}-helper`} className="text-small text-text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
