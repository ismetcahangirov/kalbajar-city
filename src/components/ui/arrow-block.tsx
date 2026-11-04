import type { ComponentProps, ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { omit } from "@/lib/omit";

export type ArrowBlockTone = "cream" | "ink";

/** The fill and its hover colour; the label takes the other end of the palette. */
const toneClass: Record<ArrowBlockTone, string> = {
  cream: "bg-cream text-ink [--arrow-block-hover:var(--color-cream-hover)]",
  ink: "bg-ink text-cream [--arrow-block-hover:var(--color-ink-hover)]",
};

type Common = {
  /** The label, set top-left in caps. */
  children: ReactNode;
  tone?: ArrowBlockTone;
  /** Which way the circled arrow points: on (`right`) or a download (`down`). */
  arrow?: "right" | "down";
  className?: string;
};

type AsLink = Common & {
  as: "link";
  /** A localised route, as `Link` from `@/i18n/navigation` takes it. */
  href: ComponentProps<typeof Link>["href"];
};

type AsAnchor = Common &
  Omit<ComponentProps<"a">, "children" | "className"> & {
    /** A plain anchor: same-page fragments, files, `tel:`. */
    as: "a";
    href: string;
  };

type AsButton = Common &
  Omit<ComponentProps<"button">, "children" | "className"> & {
    as?: "button";
  };

export type ArrowBlockProps = AsLink | AsAnchor | AsButton;

/** The reference's 20 px circled arrow, in `currentColor`. */
export function CircledArrow({ direction = "right" }: { direction?: "right" | "down" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden
      focusable={false}
      className={cx("shrink-0", direction === "down" && "rotate-90")}
    >
      <circle cx="10" cy="10" r="9.5" />
      <path d="M5.5 10h9M11 6.5l3.5 3.5-3.5 3.5" />
    </svg>
  );
}

/**
 * The 330 × 90 block CTA (ui-kit.md → ArrowBlock): label top-left, circled
 * arrow bottom-right, a cream or ink fill whose hover colour fades in over
 * `--duration-slow`. Renders a localised `Link` (`as="link"`), a plain anchor
 * (`as="a"`) or a button (the default).
 */
export function ArrowBlock(props: ArrowBlockProps) {
  const { children, tone = "cream", arrow = "right", className } = props;
  const classes = cx(
    "arrow-block relative isolate flex h-[5.625rem] w-[20.625rem] max-w-full flex-col justify-between p-5",
    "text-start text-label uppercase",
    "disabled:pointer-events-none disabled:opacity-(--opacity-disabled)",
    toneClass[tone],
    className,
  );
  const content = (
    <>
      <span>{children}</span>
      <span className="self-end">
        <CircledArrow direction={arrow} />
      </span>
    </>
  );

  if (props.as === "link") {
    return (
      <Link href={props.href} className={classes}>
        {content}
      </Link>
    );
  }
  if (props.as === "a") {
    const anchor = omit(props, ["as", "children", "tone", "arrow", "className"]);
    return (
      <a {...anchor} className={classes}>
        {content}
      </a>
    );
  }
  const button = omit(props, ["as", "children", "tone", "arrow", "className"]);
  return (
    <button type="button" {...button} className={classes}>
      {content}
    </button>
  );
}
