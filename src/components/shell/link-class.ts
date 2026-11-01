import { cx } from "@/lib/cx";

/**
 * A text link with the underline that draws in from the left on hover and
 * stays drawn for the current page (`aria-current`), so the current page is
 * marked by more than colour. At least 44 px tall for touch.
 */
export function underlineLinkClass(className?: string): string {
  return cx(
    "relative inline-flex min-h-target items-center gap-2",
    "after:absolute after:inset-x-0 after:bottom-2 after:h-px after:origin-left after:scale-x-0 after:bg-current",
    "after:transition-transform after:duration-(--duration-fast) after:ease-standard",
    "hover:after:scale-x-100 aria-[current=page]:after:scale-x-100",
    className,
  );
}
