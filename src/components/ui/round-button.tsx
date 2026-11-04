import type { ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { omit } from "@/lib/omit";

export type RoundButtonTone = "line" | "cream" | "ink";

/**
 * The circle's border, fill and the icon colour. `line` is the reference's
 * outlined circle on any theme: its border is the theme's control colour,
 * which passes 3 : 1 (ui-kit.md → Themes, note 4).
 */
const toneClass: Record<RoundButtonTone, string> = {
  line: "text-(--t-text) [--round-button-border:var(--t-control)] [--round-button-fill:transparent]",
  cream:
    "text-ink [--round-button-border:var(--color-cream)] [--round-button-fill:var(--color-cream)]",
  ink: "text-cream [--round-button-border:var(--color-ink)] [--round-button-fill:var(--color-ink)]",
};

type Common = {
  /** The accessible name: the button shows only its icon. */
  label: string;
  /** A 16–20 px icon in `currentColor`, decorative (`aria-hidden`). */
  icon: ReactNode;
  tone?: RoundButtonTone;
  className?: string;
};

type AsLink = Common & {
  as: "link";
  href: ComponentProps<typeof Link>["href"];
};

type AsAnchor = Common &
  Omit<ComponentProps<"a">, "children" | "className" | "aria-label"> & {
    as: "a";
    href: string;
  };

type AsButton = Common &
  Omit<ComponentProps<"button">, "children" | "className" | "aria-label"> & {
    as?: "button";
  };

export type RoundButtonProps = AsLink | AsAnchor | AsButton;

/**
 * A 30 px round icon button in a 44 × 44 hit area (ui-kit.md → RoundButton).
 * The circle is a pseudo-element that grows ×1.0667 on hover (A37). Renders
 * a localised `Link` (`as="link"`), a plain anchor (`as="a"`) or a button.
 */
export function RoundButton(props: RoundButtonProps) {
  const { label, icon, tone = "line", className } = props;
  const classes = cx(
    "round-button relative isolate grid size-target shrink-0 place-items-center rounded-full",
    "disabled:pointer-events-none disabled:opacity-(--opacity-disabled)",
    toneClass[tone],
    className,
  );

  if (props.as === "link") {
    return (
      <Link href={props.href} aria-label={label} className={classes}>
        {icon}
      </Link>
    );
  }
  if (props.as === "a") {
    const anchor = omit(props, ["as", "label", "icon", "tone", "className"]);
    return (
      <a {...anchor} aria-label={label} className={classes}>
        {icon}
      </a>
    );
  }
  const button = omit(props, ["as", "label", "icon", "tone", "className"]);
  return (
    <button type="button" {...button} aria-label={label} className={classes}>
      {icon}
    </button>
  );
}
