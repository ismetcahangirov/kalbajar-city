/**
 * The two grid lines at the thirds of the catalogue and apartment pages
 * (ui-kit.md → Grid lines), static and behind the content. The drawing-in
 * `GridLines` primitive is #63's; this gives way to it. Mobile keeps the
 * first line.
 */
export function CurtainLines() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 -z-1">
      <span className="absolute inset-y-0 start-1/3 w-(--grid-line-width) bg-(--t-line)" />
      <span className="absolute inset-y-0 start-2/3 hidden w-(--grid-line-width) bg-(--t-line) desk:block" />
    </span>
  );
}
