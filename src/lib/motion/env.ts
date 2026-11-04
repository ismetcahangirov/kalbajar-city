/** Media conditions every primitive checks before it moves anything. */

const reducedQuery = "(prefers-reduced-motion: reduce)";
const finePointerQuery = "(pointer: fine)";

export function prefersReducedMotion(): boolean {
  return window.matchMedia(reducedQuery).matches;
}

/** Desktop pointers: Lenis and scrubbed parallax run only here. */
export function hasFinePointer(): boolean {
  return window.matchMedia(finePointerQuery).matches;
}

/** Calls `listener` when the visitor turns reduced motion on mid-visit. */
export function onReducedMotion(listener: () => void): () => void {
  const query = window.matchMedia(reducedQuery);
  const handle = () => {
    if (query.matches) listener();
  };
  query.addEventListener("change", handle);
  return () => query.removeEventListener("change", handle);
}

/**
 * True when the element starts entirely below the viewport. Entries only hide
 * such elements, so nothing a visitor can already see is ever hidden
 * (motion-system.md → rule 3), including after a restored scroll position.
 */
export function isBelowViewport(element: Element): boolean {
  return element.getBoundingClientRect().top >= window.innerHeight;
}

/**
 * The reference's desktop motion switch: a fine pointer and at least 668 px
 * (`desk:`). Reveals, scrubbed scenes and pins run only here; touch and
 * narrow screens get the static mobile variants. Kept in step with the
 * `@media` that pins scenes in src/styles/scenes.css.
 */
const desktopQuery = "(pointer: fine) and (width >= 41.75rem)";

export function isDesktopMotion(): boolean {
  return window.matchMedia(desktopQuery).matches;
}

/**
 * Where a primitive moves: `desktop` (the default, fine pointers ≥ 668 px)
 * or `always` (a mobile variant that keeps the effect). Never under reduced
 * motion.
 */
export type MotionMode = "desktop" | "always";

/**
 * Runs `start` while motion is allowed in `mode` and calls the cleanup it
 * returns as soon as it is not: reduced motion turned on mid-visit, or the
 * window narrowed below the desktop switch. `start` runs again when motion
 * is allowed again. The returned function stops watching and cleans up.
 */
export function whileMotion(mode: MotionMode, start: () => () => void): () => void {
  const reduced = window.matchMedia(reducedQuery);
  const desktop = window.matchMedia(desktopQuery);
  let stop: (() => void) | null = null;
  const update = () => {
    const allowed = !reduced.matches && (mode === "always" || desktop.matches);
    if (allowed && !stop) stop = start();
    else if (!allowed && stop) {
      stop();
      stop = null;
    }
  };
  reduced.addEventListener("change", update);
  if (mode === "desktop") desktop.addEventListener("change", update);
  update();
  return () => {
    reduced.removeEventListener("change", update);
    desktop.removeEventListener("change", update);
    stop?.();
    stop = null;
  };
}

/**
 * Applies a start state without a transition: `apply` runs with transitions
 * suspended on the element (`data-instant`) and they come back two frames
 * later, once the browser has computed the new state. Used when a primitive
 * hides an element below the viewport after hydration.
 */
export function instantly(element: HTMLElement, apply: () => void): void {
  element.dataset.instant = "";
  apply();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      delete element.dataset.instant;
    }),
  );
}
