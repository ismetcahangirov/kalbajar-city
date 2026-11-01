import { onReducedMotion } from "./env";
import { onMeasure, onScrollFrame } from "./frame";
import { stagger, triggerLine } from "./tokens";

/**
 * The scroll-entry trigger shared by `FadeUp`, `LineReveal`, `ImageReveal`
 * and `CountUp` (motion-system.md → rule 2). One `IntersectionObserver`
 * watches every waiting element; elements that cross the trigger line in the
 * same frame enter as a group, staggered in document order. Entries run once.
 */

export type EntryKind = "block" | "image";

export type Entry = {
  kind: EntryKind;
  /**
   * Starts the entry after `delay` milliseconds. Returns a function that jumps
   * it to its final state, used when reduced motion is turned on mid-entry.
   */
  play: (delay: number) => () => void;
  /** Shows the final state at once, without animating. */
  reveal: () => void;
};

const waiting = new Map<Element, Entry>();
const running = new Map<Element, () => void>();
let observer: IntersectionObserver | null = null;
let stopBottomCheck: (() => void) | null = null;
let stopReducedListener: (() => void) | null = null;

function staggerOf(kind: EntryKind): number {
  return kind === "image" ? stagger.image : stagger.block;
}

function enter(elements: Element[]) {
  elements.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
  const index: Record<EntryKind, number> = { block: 0, image: 0 };
  for (const element of elements) {
    const entry = waiting.get(element);
    if (!entry) continue;
    forget(element);
    // Items after the sixth enter with the sixth.
    const position = Math.min(index[entry.kind]++, stagger.max - 1);
    const finish = entry.play(position * staggerOf(entry.kind));
    running.set(element, finish);
    // Long enough for the slowest entry plus its stagger; then let it go.
    window.setTimeout(() => running.delete(element), 4000);
  }
}

function forget(element: Element) {
  waiting.delete(element);
  observer?.unobserve(element);
  if (waiting.size === 0) {
    stopBottomCheck?.();
    stopBottomCheck = null;
  }
}

/**
 * An element close to the end of the page may never reach the trigger line,
 * because the page cannot scroll that far. At the bottom, everything visible
 * enters.
 */
let viewport = 0;
let maxScroll = 0;

function measurePage() {
  viewport = window.innerHeight;
  maxScroll = document.documentElement.scrollHeight - viewport;
}

function enterAtBottom(scrollY: number) {
  // Cached on resize: reading the page height here would force a layout in
  // every scroll frame.
  if (scrollY < maxScroll - 2) return;
  enter([...waiting.keys()].filter((element) => element.getBoundingClientRect().top < viewport));
}

function watchBottom(): () => void {
  const stopMeasure = onMeasure(measurePage);
  const stopScroll = onScrollFrame(enterAtBottom);
  return () => {
    stopMeasure();
    stopScroll();
  };
}

function revealEverything() {
  for (const [element, entry] of waiting) {
    forget(element);
    entry.reveal();
  }
  for (const finish of running.values()) finish();
  running.clear();
}

function ensureObserver(): IntersectionObserver {
  if (!observer) {
    const inset = Math.round((1 - triggerLine) * 100);
    observer = new IntersectionObserver(
      (records) => enter(records.filter((r) => r.isIntersecting).map((r) => r.target)),
      { rootMargin: `0px 0px -${inset}% 0px` },
    );
    stopReducedListener = onReducedMotion(revealEverything);
  }
  return observer;
}

/**
 * Waits for the element to cross the trigger line, then plays its entry. The
 * caller has already hidden the element (only if it was below the viewport).
 * The returned cleanup shows the final state, so an unmounted or re-mounted
 * component never leaves content hidden.
 */
export function registerEntry(element: Element, entry: Entry): () => void {
  waiting.set(element, entry);
  ensureObserver().observe(element);
  stopBottomCheck ??= watchBottom();
  return () => {
    if (waiting.has(element)) {
      forget(element);
      entry.reveal();
    }
    running.get(element)?.();
    running.delete(element);
    if (waiting.size === 0 && running.size === 0 && observer) {
      observer.disconnect();
      observer = null;
      stopReducedListener?.();
      stopReducedListener = null;
    }
  };
}
