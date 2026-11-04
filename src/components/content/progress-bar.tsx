import { cx } from "@/lib/cx";

/**
 * A labelled progress bar: the visible label carries the number, so the bar
 * is never the only cue. The fill is a `scaleX` of a full-width layer.
 */
export function ProgressBar({
  value,
  label,
  id,
  className,
}: {
  /** 0–100. */
  value: number;
  /** The visible text, such as "64% complete". */
  label: string;
  id: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <p id={id} className="text-legacy-title">
        {label}
      </p>
      <div
        role="progressbar"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={label}
        className="h-1 overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full origin-left bg-text-accent rtl:origin-right"
          style={{ transform: `scaleX(${value / 100})` }}
        />
      </div>
    </div>
  );
}
