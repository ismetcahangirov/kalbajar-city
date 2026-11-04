"use client";

import { useEffect, useRef, useState } from "react";

import { CircleToggle } from "./circle-sign";

/**
 * The ⊕ / ⊖ button of a `HoverList` row on touch screens (ui-kit.md →
 * HoverList): a one-open accordion. Opening a row closes the others; the
 * row's `data-open` shows its caption (src/styles/home.css). With a mouse
 * the list works on hover and this button is not shown.
 */
export function HoverListToggle({
  controls,
  label,
  initiallyOpen,
}: {
  controls: string;
  label: string;
  initiallyOpen: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    const row = ref.current?.closest<HTMLElement>("[data-hover-row]");
    if (!row) return;
    // Another row opened: this one closes.
    const close = (event: Event) => {
      if (event.target !== row) setOpen(false);
    };
    const list = row.parentElement;
    list?.addEventListener("hover-list:open", close);
    return () => list?.removeEventListener("hover-list:open", close);
  }, []);

  useEffect(() => {
    const row = ref.current?.closest<HTMLElement>("[data-hover-row]");
    if (!row) return;
    if (open) {
      row.dataset.open = "";
      row.dispatchEvent(new Event("hover-list:open", { bubbles: true }));
    } else delete row.dataset.open;
  }, [open]);

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      onClick={() => setOpen((value) => !value)}
      className="relative flex size-target shrink-0 items-center justify-center pointer-desk:hidden"
    >
      <CircleToggle />
    </button>
  );
}
