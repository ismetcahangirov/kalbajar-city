import type { ComponentProps, CSSProperties } from "react";

import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { omit } from "@/lib/omit";

type Common = {
  /** The plain label: the accessible name, and the text that rolls. */
  label: string;
  className?: string;
};

type AsLink = Common &
  Omit<ComponentProps<typeof Link>, "children" | "className" | "aria-label"> & { as?: "link" };

type AsAnchor = Common &
  Omit<ComponentProps<"a">, "children" | "className" | "aria-label"> & { as: "a"; href: string };

type AsButton = Common &
  Omit<ComponentProps<"button">, "children" | "className" | "aria-label"> & { as: "button" };

export type RollLinkProps = AsLink | AsAnchor | AsButton;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** One span per grapheme, so `Ə` and `İ` roll whole; spaces keep their width. */
function Row({ label, row }: { label: string; row: 1 | 2 }) {
  return (
    <span data-roll-row={row} className="roll-link__row">
      {Array.from(segmenter.segment(label), ({ segment }, i) => (
        <span key={i} style={{ "--i": i } as CSSProperties}>
          {segment === " " ? "\u00a0" : segment}
        </span>
      ))}
    </span>
  );
}

/**
 * A caps link with the reference's character roll (A36, ui-kit.md →
 * RollLink): the label twice, one span per character; on hover the first
 * row leaves upward through a clip while the second rises from below,
 * `--stagger-roll` apart. Under reduced motion the hover is an underline
 * instead. The accessible name is the plain label; the hit area reaches
 * 44 px tall and 15 px past each side. Renders a localised `Link` (the
 * default), a plain anchor (`as="a"`: `tel:`, fragments) or a button.
 */
export function RollLink(props: RollLinkProps) {
  const { label, className } = props;
  const classes = cx("roll-link", className);
  const content = (
    <span aria-hidden="true" className="roll-link__clip">
      <Row label={label} row={1} />
      <Row label={label} row={2} />
    </span>
  );

  if (props.as === "a") {
    const anchor = omit(props, ["as", "label", "className"]);
    return (
      <a {...anchor} aria-label={label} className={classes}>
        {content}
      </a>
    );
  }
  if (props.as === "button") {
    const button = omit(props, ["as", "label", "className"]);
    return (
      <button type="button" {...button} aria-label={label} className={classes}>
        {content}
      </button>
    );
  }
  const link = omit(props, ["as", "label", "className"]);
  return (
    <Link {...link} aria-label={label} className={classes}>
      {content}
    </Link>
  );
}
