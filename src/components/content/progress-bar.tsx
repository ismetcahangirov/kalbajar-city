import { cx } from "@/lib/cx";

/**
 * A labelled progress bar: the visible label carries the number, so the bar
 * is never the only cue. A 1 px track in the theme's control colour with a
 * 1 px fill in its text colour, as the reference's range track; the fill is
 * a `scaleX` of a full-width layer.
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
    <div className={cx("flex flex-col gap-u", className)}>
      <p id={id} className="text-lead">
        {label}
      </p>
      <div
        role="progressbar"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={label}
        className="relative h-[0.1875rem] overflow-hidden before:absolute before:inset-x-0 before:top-px before:h-px before:bg-(--t-control)"
      >
        <div
          className="relative h-full origin-left bg-(--t-text) rtl:origin-right"
          style={{ transform: `scaleX(${value / 100})` }}
        />
      </div>
    </div>
  );
}
