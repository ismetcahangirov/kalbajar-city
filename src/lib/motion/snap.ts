import { heroSnap } from "./tokens";

/**
 * The hero snap's decisions (A43), pure so they are unit-tested: the home
 * hero snaps between 0 and one viewport down on wheel input in the first
 * viewport; going down it snaps forward once the wheel has asked for a fifth
 * of a viewport; going up into the hero it snaps back to the top.
 */

/**
 * Where a wheel turn of `deltaY` from `scroll` snaps to, or null when it
 * scrolls freely (outside the hero, or a small turn that has not reached
 * the threshold yet).
 */
export function heroSnapTarget(scroll: number, deltaY: number, viewport: number): number | null {
  if (deltaY === 0 || viewport <= 0) return null;
  if (deltaY < 0) return scroll > 0 && scroll + deltaY < viewport ? 0 : null;
  if (scroll >= viewport - 1) return null;
  return scroll + deltaY >= viewport * heroSnap.threshold ? viewport : null;
}

/**
 * Where the scroll settles when the wheel stops inside the hero: back to the
 * top before the threshold, forward after it; null when it is at rest.
 */
export function heroSnapSettle(scroll: number, viewport: number): number | null {
  if (viewport <= 0 || scroll <= 0.5 || scroll >= viewport - 0.5) return null;
  return scroll < viewport * heroSnap.threshold ? 0 : viewport;
}
