import type Lenis from "lenis";

/**
 * One `requestAnimationFrame` loop for everything scroll-linked: it advances
 * Lenis when smooth scrolling is on and then hands the scroll position to the
 * scrubbed primitives in the same frame, so there are never two loops
 * (motion-system.md → Smooth scroll).
 *
 * Within a frame, reads come before writes: Lenis scrolls, `onMeasure`
 * listeners read the layout (only after a resize), `onScrollFrame` listeners
 * get the scroll position and write styles from cached geometry, and `onFrame`
 * callbacks (CountUp) write last. The scroll position is taken from the
 * scroll event or from Lenis, never read in the frame, because reading
 * `window.scrollY` after a style write forces a style recalculation.
 */

type ScrollListener = (scrollY: number) => void;
type MeasureListener = () => void;
type FrameCallback = (time: number) => boolean;

const scrollListeners = new Set<ScrollListener>();
const measureListeners = new Set<MeasureListener>();
const frameCallbacks = new Set<FrameCallback>();

let lenis: Lenis | null = null;
const lenisListeners = new Set<(instance: Lenis | null) => void>();
let frame = 0;
let scrollDirty = false;
let measureDirty = false;
let scrollY: number | null = null;
let started = false;
let bodyObserver: ResizeObserver | null = null;

function tick(time: number) {
  frame = 0;
  lenis?.raf(time);
  if (measureDirty) {
    measureDirty = false;
    scrollDirty = true;
    for (const listener of measureListeners) listener();
  }
  if (scrollDirty) {
    scrollDirty = false;
    scrollY ??= window.scrollY;
    for (const listener of scrollListeners) listener(scrollY);
  }
  for (const callback of frameCallbacks) {
    if (!callback(time)) frameCallbacks.delete(callback);
  }
  schedule();
}

function schedule() {
  if (frame) return;
  // Lenis animates between wheel events, so it needs every frame; without it
  // the loop sleeps until the page scrolls or resizes.
  if (lenis || scrollDirty || measureDirty || frameCallbacks.size) {
    frame = requestAnimationFrame(tick);
  }
}

function markScroll() {
  scrollDirty = true;
  schedule();
}

function onNativeScroll() {
  // Scroll events run before animation frames, while the layout is clean.
  if (!lenis) scrollY = window.scrollY;
  markScroll();
}

function markMeasure() {
  measureDirty = true;
  schedule();
}

function start() {
  if (started) return;
  started = true;
  window.addEventListener("scroll", onNativeScroll, { passive: true });
  window.addEventListener("resize", markMeasure);
  // Late images, fonts and route changes move everything below them.
  bodyObserver = new ResizeObserver(markMeasure);
  bodyObserver.observe(document.body);
}

function stopIfIdle() {
  if (!started || scrollListeners.size || measureListeners.size || lenis) return;
  scrollY = null;
  started = false;
  window.removeEventListener("scroll", onNativeScroll);
  window.removeEventListener("resize", markMeasure);
  bodyObserver?.disconnect();
  bodyObserver = null;
}

/** Runs on every frame in which the scroll position may have changed. */
export function onScrollFrame(listener: ScrollListener): () => void {
  scrollListeners.add(listener);
  start();
  markScroll();
  return () => {
    scrollListeners.delete(listener);
    stopIfIdle();
  };
}

/** Runs before the next scroll frame whenever the layout may have changed. */
export function onMeasure(listener: MeasureListener): () => void {
  measureListeners.add(listener);
  start();
  markMeasure();
  return () => {
    measureListeners.delete(listener);
    stopIfIdle();
  };
}

/**
 * Runs `callback` once per frame, after the scroll listeners, until it
 * returns false.
 */
export function onFrame(callback: FrameCallback): () => void {
  frameCallbacks.add(callback);
  schedule();
  return () => frameCallbacks.delete(callback);
}

/** Lets the loop drive a Lenis instance created with `autoRaf: false`. */
export function attachLenis(instance: Lenis): () => void {
  lenis = instance;
  for (const listener of lenisListeners) listener(instance);
  const onLenisScroll = () => {
    scrollY = instance.scroll;
    markScroll();
  };
  instance.on("scroll", onLenisScroll);
  start();
  schedule();
  return () => {
    if (lenis === instance) {
      lenis = null;
      scrollY = null;
      for (const listener of lenisListeners) listener(null);
    }
    stopIfIdle();
  };
}

/**
 * Calls `listener` with the running Lenis instance now and whenever it
 * changes (null when smooth scrolling stops). Lenis loads after hydration
 * and only for fine pointers, so the hero snap waits for it here.
 */
export function onLenis(listener: (instance: Lenis | null) => void): () => void {
  lenisListeners.add(listener);
  listener(lenis);
  return () => lenisListeners.delete(listener);
}

export type VirtualScroll = { deltaX: number; deltaY: number; event: WheelEvent | TouchEvent };

const virtualScrollGuards = new Set<(data: VirtualScroll) => boolean>();

/**
 * Lets a primitive take over a wheel or touch gesture before Lenis scrolls
 * with it: a guard that returns false consumes the event (the hero snap).
 */
export function onVirtualScroll(guard: (data: VirtualScroll) => boolean): () => void {
  virtualScrollGuards.add(guard);
  return () => virtualScrollGuards.delete(guard);
}

/** Lenis's `virtualScroll` option: true lets Lenis scroll with the event. */
export function allowVirtualScroll(data: VirtualScroll): boolean {
  for (const guard of virtualScrollGuards) if (!guard(data)) return false;
  return true;
}

/**
 * The element's layout top relative to the document, from the offset chain:
 * unlike `getBoundingClientRect`, it ignores transforms, so a scrubbed
 * element measuring itself is not moved by what it wrote. Measure the scene
 * (not a sticky layer, whose offset follows the scroll) for anything pinned.
 */
export function layoutTop(element: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return top;
}

/** The element's top relative to the document, for caching between frames. */
export function documentTop(element: Element): number {
  return element.getBoundingClientRect().top + window.scrollY;
}
