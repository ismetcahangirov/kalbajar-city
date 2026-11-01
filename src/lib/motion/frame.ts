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
    }
    stopIfIdle();
  };
}

/** The element's top relative to the document, for caching between frames. */
export function documentTop(element: Element): number {
  return element.getBoundingClientRect().top + window.scrollY;
}
