"use client";

import { useEffect, useRef } from "react";

/**
 * After a selection changes in place, a hotspot or list link that was
 * focused may no longer exist. Focus then moves to the new level's heading,
 * so keyboard and screen-reader users land on what changed instead of the
 * top of the document. A focused link that survived (the block and floor
 * links) keeps focus.
 */
export function SelectionFocus({ target, selection }: { target: string; selection: string }) {
  const previous = useRef(selection);
  useEffect(() => {
    if (previous.current === selection) return;
    previous.current = selection;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    document.getElementById(target)?.focus();
  }, [target, selection]);
  return null;
}
