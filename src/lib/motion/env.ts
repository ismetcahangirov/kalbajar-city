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
