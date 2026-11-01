import type { ReactNode } from "react";

import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";

type StatProps = {
  value: number;
  locale: Locale;
  unit?: string;
  label: string;
  maximumFractionDigits?: number;
  /**
   * Replaces the formatted numeral, for `<CountUp>`. A slot rather than a
   * flag, so pages without an animated stat never load the counter.
   */
  numeral?: ReactNode;
  className?: string;
};

/**
 * A numeral and its label, inside a `<dl>`. Numbers are formatted per locale;
 * `numeral` takes a CountUp inside the same markup. The label comes first
 * for assistive tech, the numeral first on
 * screen.
 */
export function Stat({
  value,
  locale,
  unit,
  label,
  maximumFractionDigits = 0,
  numeral,
  className,
}: StatProps) {
  const formatted = formatNumber(value, locale, { maximumFractionDigits });
  return (
    <div className={cx("flex flex-col-reverse gap-2", className)}>
      <dt className="text-small text-text-muted">{label}</dt>
      <dd className="text-stat text-text">
        <span data-stat-value={value}>{numeral ?? formatted}</span>
        {unit && <span className="ms-2 text-title text-text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
