import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";

type StatProps = {
  value: number;
  locale: Locale;
  unit?: string;
  label: string;
  maximumFractionDigits?: number;
  className?: string;
};

/**
 * A numeral and its label, inside a `<dl>`. Numbers are formatted per locale;
 * the motion issue animates the numeral with CountUp without changing this
 * markup. The label comes first for assistive tech, the numeral first on
 * screen.
 */
export function Stat({
  value,
  locale,
  unit,
  label,
  maximumFractionDigits = 0,
  className,
}: StatProps) {
  const formatted = formatNumber(value, locale, { maximumFractionDigits });
  return (
    <div className={cx("flex flex-col-reverse gap-2", className)}>
      <dt className="text-small text-text-muted">{label}</dt>
      <dd className="text-stat text-text">
        <span data-stat-value={value}>{formatted}</span>
        {unit && <span className="ms-2 text-title text-text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
