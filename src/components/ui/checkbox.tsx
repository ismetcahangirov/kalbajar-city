import { Check } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "@/lib/cx";

type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "id" | "size"> & {
  id: string;
  /** May contain a link, such as the consent text. */
  label: ReactNode;
  error?: string;
  /**
   * `form`: the 24 px box of the current forms (semantic tokens), until the
   * inquiry form is rebuilt with `FieldBox` (#64). `filter`: the hairline
   * 15 × 15 box of the catalogue's filters, and `box` the 20 × 20 hairline
   * box beside a `FieldBox` (the inquiry dialog), both on the theme tokens
   * (ui-kit.md → Checkbox). All sit in a 44 px hit area and change instantly.
   */
  size?: "form" | "filter" | "box";
};

export function Checkbox({ size = "form", ...props }: CheckboxProps) {
  if (size === "filter") return <FilterCheckbox {...props} />;
  if (size === "box") return <BoxCheckbox {...props} />;
  return <FormCheckbox {...props} />;
}

/** The hairline 20 px form box; its label may hold a link, so only the box is the input. */
function BoxCheckbox({ id, label, error, className, ...props }: Omit<CheckboxProps, "size">) {
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <span className="relative grid size-target shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
          {...props}
        />
        <span
          aria-hidden
          className={cx(
            "pointer-events-none grid size-5 place-items-center border border-(--t-control) text-transparent",
            "peer-checked:border-(--t-text) peer-checked:text-(--t-text) peer-hover:border-(--t-text)",
            "peer-focus-visible:outline-(length:--focus-ring-width) peer-focus-visible:outline-offset-(--focus-ring-width) peer-focus-visible:outline-(--t-text) peer-focus-visible:outline-solid",
            "peer-aria-invalid:border-error peer-aria-invalid:outline-1 peer-aria-invalid:outline-error peer-aria-invalid:outline-solid",
          )}
        >
          <Check width={14} height={14} strokeWidth={1.5} aria-hidden focusable={false} />
        </span>
      </span>
      <label htmlFor={id} className="cursor-pointer py-2.5 text-small-t text-(--t-text)">
        {label}
      </label>
    </div>
  );
}

function FormCheckbox({ id, label, error, className, ...props }: Omit<CheckboxProps, "size">) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <div className="flex items-start gap-3">
        <span className="relative grid size-target shrink-0 place-items-center">
          <input
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
            {...props}
          />
          <span
            aria-hidden
            className={cx(
              "grid size-6 place-items-center rounded-sm border border-border-strong bg-surface-raised text-transparent",
              "peer-checked:border-action peer-checked:bg-action peer-checked:text-action-text",
              "peer-focus-visible:outline-(length:--focus-ring-width) peer-focus-visible:outline-offset-(--focus-ring-offset) peer-focus-visible:outline-focus peer-focus-visible:outline-solid",
              "peer-aria-invalid:border-2 peer-aria-invalid:border-error",
              "peer-disabled:opacity-(--opacity-disabled)",
            )}
          >
            <Check width={16} height={16} strokeWidth={2} aria-hidden focusable={false} />
          </span>
        </span>
        <label htmlFor={id} className="cursor-pointer py-2.5 text-body text-text">
          {label}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} className="ps-14 text-small text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** The filter box: the whole row is the 44 px target, the box is 15 px. */
function FilterCheckbox({ id, label, className, ...props }: Omit<CheckboxProps, "size">) {
  return (
    <div className={cx("relative flex min-h-target items-center gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
        {...props}
      />
      <span
        aria-hidden
        className={cx(
          "pointer-events-none grid size-[0.9375rem] shrink-0 place-items-center border border-(--t-control) text-transparent",
          "peer-hover:border-(--t-text)",
          "peer-checked:border-(--t-text) peer-checked:text-(--t-text)",
          "peer-focus-visible:outline-(length:--focus-ring-width) peer-focus-visible:outline-offset-(--focus-ring-width) peer-focus-visible:outline-(--t-text) peer-focus-visible:outline-solid",
          "peer-disabled:opacity-(--opacity-disabled)",
        )}
      >
        <Check width={11} height={11} strokeWidth={2} aria-hidden focusable={false} />
      </span>
      <label
        htmlFor={id}
        className="pointer-events-none text-body text-(--t-text) peer-disabled:opacity-(--opacity-disabled)"
      >
        {label}
      </label>
    </div>
  );
}
