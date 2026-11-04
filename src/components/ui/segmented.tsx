import type { ChangeEvent, ReactNode } from "react";

import { cx } from "@/lib/cx";

export type SegmentedOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

type SegmentedProps = {
  /** The group's visible name, in `--text-label-xs` caps. */
  legend: string;
  /** The form field's name; every checked cell submits its value under it. */
  name: string;
  options: SegmentedOption[];
  /** The checked values. */
  value: string[];
  /** `checkbox` (any number of cells, the default) or `radio` (one). */
  type?: "checkbox" | "radio";
  /** Unique on the page: the cells' ids derive from it. */
  idPrefix: string;
  onChange?: (value: string, checked: boolean) => void;
  className?: string;
};

/**
 * Equal cells joined by −1 px borders (ui-kit.md → Segmented): the
 * reference's room and finish pickers. Each cell is a native checkbox or
 * radio, so Tab reaches it, Space toggles it (arrows move between radios)
 * and the group submits with its form without JavaScript. Checked is the
 * text colour's fill with the background colour's text. Nothing animates.
 * Event handlers make it a client-side control: use it from a client
 * component when `onChange` is passed.
 */
export function Segmented({
  legend,
  name,
  options,
  value,
  type = "checkbox",
  idPrefix,
  onChange,
  className,
}: SegmentedProps) {
  return (
    <fieldset className={cx("m-0 flex min-w-0 flex-col gap-u border-0 p-0", className)}>
      <legend className="mb-u p-0 text-label-xs text-(--t-small) uppercase">{legend}</legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] ps-px pt-px">
        {options.map((option) => {
          const id = `${idPrefix}-${option.value}`;
          return (
            <span key={option.value} className="relative -ms-px -mt-px flex">
              <input
                id={id}
                type={type}
                name={name}
                value={option.value}
                checked={value.includes(option.value)}
                disabled={option.disabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onChange?.(option.value, event.currentTarget.checked)
                }
                className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-default"
              />
              <label
                htmlFor={id}
                className={cx(
                  "pointer-events-none flex min-h-target w-full items-center justify-center px-2 text-center",
                  "border border-(--t-control) text-body text-(--t-text)",
                  "peer-hover:z-1 peer-hover:border-(--t-text)",
                  "peer-checked:z-1 peer-checked:border-(--t-text) peer-checked:bg-(--t-text) peer-checked:text-(--t-bg)",
                  "peer-focus-visible:z-2 peer-focus-visible:outline-(length:--focus-ring-width) peer-focus-visible:outline-offset-(--focus-ring-width) peer-focus-visible:outline-(--t-text) peer-focus-visible:outline-solid",
                  "peer-disabled:opacity-(--opacity-disabled)",
                )}
              >
                {option.label}
              </label>
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}
