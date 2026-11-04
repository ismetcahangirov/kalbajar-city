/** The reference's 15 px ⊕ / ⊖ (HoverList, FAQ), in `currentColor`. */
export function CircleSign({
  minus = false,
  ...props
}: { minus?: boolean } & Record<`data-${string}`, string>) {
  return (
    <svg
      viewBox="0 0 15 15"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden
      focusable={false}
      className="shrink-0"
      {...props}
    >
      <circle cx="7.5" cy="7.5" r="7" />
      <path d={minus ? "M4.5 7.5h6" : "M4.5 7.5h6M7.5 4.5v6"} />
    </svg>
  );
}

/** ⊕ and ⊖ stacked, so CSS can swap them by opacity (A33) or `display`. */
export function CircleToggle() {
  return (
    <span aria-hidden="true" className="relative flex size-[15px] shrink-0">
      <span data-icon-closed="" className="absolute inset-0">
        <CircleSign />
      </span>
      <span data-icon-open="" className="absolute inset-0">
        <CircleSign minus />
      </span>
    </span>
  );
}
