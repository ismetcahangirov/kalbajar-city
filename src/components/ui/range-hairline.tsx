import type { CSSProperties } from "react";

import { cx } from "@/lib/cx";

type Bound = 0 | 1;

type RangeHairlineProps = {
  /** The group's visible name, in `--text-label-xs` caps. */
  legend: string;
  /** Unique on the page: the fields' ids derive from it. */
  idPrefix: string;
  /** The form field names of the lower and upper bound. */
  names: [string, string];
  /** The bounds as typed; an empty string is "no bound". */
  value: [string, string];
  /** What the data spans: the slider's ends and the fields' placeholders. */
  bounds: { min: number; max: number } | null;
  /** The slider's step; the fields accept anything `fieldStep` allows. */
  step?: number;
  fieldStep?: string;
  inputMode: "decimal" | "numeric";
  /** Accessible names: the two fields and the two slider thumbs. */
  labels: { min: string; max: string; sliderMin: string; sliderMax: string };
  /** Formats a number for the placeholders and the sliders' spoken value. */
  format: (value: number) => string;
  onChange: (bound: Bound, value: string) => void;
  className?: string;
};

function parse(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? number : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * A range in the hairline language (ui-kit.md → RangeHairline): two
 * number fields side by side over a 1 px divider, and below them a 1 px
 * track with a filled connector and two 1 × 10 px ticks in 44 px hit areas.
 * The fields are the form's values (named, submitted without JavaScript);
 * the ticks are two native range inputs that write into them, so arrows,
 * Page Up/Down, Home and End move a bound from the keyboard. A thumb at its
 * end of the track clears its bound. Nothing animates. A controlled,
 * client-side control: use it from a client component.
 */
export function RangeHairline({
  legend,
  idPrefix,
  names,
  value,
  bounds,
  step = 1,
  fieldStep = "1",
  inputMode,
  labels,
  format,
  onChange,
  className,
}: RangeHairlineProps) {
  const slidable = bounds !== null && bounds.max > bounds.min;
  const lo = bounds ? clamp(parse(value[0]) ?? bounds.min, bounds.min, bounds.max) : 0;
  const hi = bounds ? clamp(parse(value[1]) ?? bounds.max, lo, bounds.max) : 0;
  const span = bounds ? bounds.max - bounds.min || 1 : 1;
  const fill = {
    "--range-from": `${((lo - (bounds?.min ?? 0)) / span) * 100}%`,
    "--range-to": `${((hi - (bounds?.min ?? 0)) / span) * 100}%`,
  } as CSSProperties;

  const slide = (bound: Bound, raw: number) => {
    if (!bounds) return;
    if (bound === 0) {
      const next = Math.min(raw, hi);
      onChange(0, next <= bounds.min ? "" : String(next));
    } else {
      const next = Math.max(raw, lo);
      // The last step on the slider's grid can fall short of the maximum.
      onChange(1, next + step > bounds.max ? "" : String(next));
    }
  };

  const fields = [
    { bound: 0 as const, label: labels.min, placeholder: bounds?.min },
    { bound: 1 as const, label: labels.max, placeholder: bounds?.max },
  ];

  return (
    <fieldset className={cx("m-0 flex min-w-0 flex-col border-0 p-0", className)}>
      <legend className="mb-u p-0 text-label-xs text-(--t-small) uppercase">{legend}</legend>
      <div className="grid grid-cols-2">
        {fields.map(({ bound, label, placeholder }) => (
          <input
            key={bound}
            id={`${idPrefix}-${names[bound]}`}
            name={names[bound]}
            aria-label={label}
            type="number"
            inputMode={inputMode}
            min={0}
            step={fieldStep}
            placeholder={placeholder !== undefined ? format(placeholder) : undefined}
            value={value[bound]}
            onChange={(event) => onChange(bound, event.currentTarget.value)}
            className={cx(
              "range-hairline__field min-h-target w-full min-w-0 bg-transparent pb-1.5 text-body text-(--t-text)",
              "placeholder:text-(--t-small)",
              bound === 1 && "border-s border-(--t-line-alt) ps-u",
            )}
          />
        ))}
      </div>
      <div className="relative h-target" style={fill}>
        {/* The track runs between the thumbs' centres at either end. */}
        <span aria-hidden className="absolute inset-x-[1.375rem] top-1/2 h-px bg-(--t-control)">
          <span className="absolute inset-y-0 start-(--range-from) end-[calc(100%-var(--range-to))] bg-(--t-text)" />
          <span className="absolute start-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-(--t-control)" />
          <span className="absolute end-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-(--t-control)" />
        </span>
        {slidable &&
          ([0, 1] as const).map((bound) => {
            const current = bound === 0 ? lo : hi;
            // Two ticks on one spot: the one that can still move goes on top.
            const lowerOnTop = bound === 0 && lo === hi && hi > bounds.min + span / 2;
            return (
              <input
                key={bound}
                type="range"
                aria-label={bound === 0 ? labels.sliderMin : labels.sliderMax}
                aria-valuetext={format(current)}
                min={bounds.min}
                max={bounds.max}
                step={step}
                value={current}
                onChange={(event) => slide(bound, Number(event.currentTarget.value))}
                className={cx("range-hairline__input", lowerOnTop && "z-1")}
              />
            );
          })}
      </div>
    </fieldset>
  );
}
