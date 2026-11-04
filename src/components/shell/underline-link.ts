import { cx } from "@/lib/cx";

/**
 * A text link whose underline is redrawn on hover (ui-kit.md →
 * UnderlineLink): the drawn line shrinks to the right while a new one grows
 * from the left (src/styles/shell.css). At least 44 px tall for touch.
 */
export function underlineLinkClass(className?: string): string {
  return cx("underline-link", className);
}
