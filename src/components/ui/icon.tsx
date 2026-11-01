import type { LucideIcon } from "lucide-react";

import { cx } from "@/lib/cx";

type IconProps = {
  icon: LucideIcon;
  /** 20 inline, 24 stand-alone. */
  size?: 20 | 24;
  /** Accessible name. Without it the icon is decorative and hidden. */
  label?: string;
  className?: string;
};

export function Icon({ icon: Glyph, size = 20, label, className }: IconProps) {
  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={1.5}
      className={cx("shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable={false}
    />
  );
}
