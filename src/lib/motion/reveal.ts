import { onMeasure, onScrollFrame } from "./frame";
import { delay, reveal, stagger } from "./tokens";

/**
 * The entry trigger of `Reveal` (spec §6.2, motion-system.md → Primitives):
 * an `IntersectionObserver` with a −100 px bottom margin, one per threshold
 * (single elements at 0, group members at .5), shared by every `Reveal` on
 * the page. Elements that enter in the same callback reveal as a batch,
 * staggered in document order by `--stagger-group` after a 30 ms delay.
 * Replaces the legacy `entry.ts` for the new primitives.
 */

export type RevealTarget = {
  /** Plays the entry after `delayMs`. */
  enter: (delayMs: number) => void;
  /** Called when a reversible target leaves below the viewport. */
  leave?: () => void;
};

type Registered = RevealTarget & { threshold: number; inside: boolean };

const targets = new Map<Element, Registered>();
const observers = new Map<number, IntersectionObserver>();
let stopBottom: (() => void) | null = null;

function documentOrder(a: Element, b: Element) {
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

function enterBatch(elements: Element[]) {
  elements.sort(documentOrder);
  let index = 0;
  for (const element of elements) {
    const target = targets.get(element);
    if (!target || target.inside) continue;
    target.inside = true;
    const position = Math.min(index++, reveal.maxStagger - 1);
    target.enter(delay.reveal + position * stagger.group);
    if (!target.leave) forget(element);
  }
}

function observerFor(threshold: number): IntersectionObserver {
  let observer = observers.get(threshold);
  if (!observer) {
    observer = new IntersectionObserver(
      (records) => {
        const entering: Element[] = [];
        for (const record of records) {
          if (record.isIntersecting) {
            entering.push(record.target);
            continue;
          }
          // A reversible target replays when it is next scrolled to, so it
          // leaves only once it is entirely below the viewport again.
          const target = targets.get(record.target);
          const below = record.boundingClientRect.top >= (record.rootBounds?.bottom ?? Infinity);
          if (target?.inside && target.leave && below) {
            target.inside = false;
            target.leave();
          }
        }
        if (entering.length) enterBatch(entering);
      },
      { rootMargin: `0px 0px -${reveal.margin}px 0px`, threshold },
    );
    observers.set(threshold, observer);
  }
  return observer;
}

/**
 * Near the end of the page an element may never cross the margin, because
 * the page cannot scroll that far: at the bottom, every waiting element in
 * the viewport enters. The page height is cached on resize.
 */
let viewport = 0;
let maxScroll = 0;

function watchBottom(): () => void {
  const stopMeasure = onMeasure(() => {
    viewport = window.innerHeight;
    maxScroll = document.documentElement.scrollHeight - viewport;
  });
  const stopScroll = onScrollFrame((scrollY) => {
    if (scrollY < maxScroll - 2) return;
    enterBatch(
      [...targets]
        .filter(([element, target]) => {
          return !target.inside && element.getBoundingClientRect().top < viewport;
        })
        .map(([element]) => element),
    );
  });
  return () => {
    stopMeasure();
    stopScroll();
  };
}

function forget(element: Element) {
  const target = targets.get(element);
  if (!target) return;
  targets.delete(element);
  observers.get(target.threshold)?.unobserve(element);
  if (targets.size === 0) {
    for (const observer of observers.values()) observer.disconnect();
    observers.clear();
    stopBottom?.();
    stopBottom = null;
  }
}

/**
 * Watches `element` for its entry. The caller has already applied the start
 * state (only to an element below the viewport). Returns the cleanup, which
 * stops watching; the caller restores the final state.
 */
export function registerReveal(
  element: Element,
  target: RevealTarget,
  { group = false }: { group?: boolean } = {},
): () => void {
  const threshold = group ? reveal.groupThreshold : 0;
  targets.set(element, { ...target, threshold, inside: false });
  observerFor(threshold).observe(element);
  stopBottom ??= watchBottom();
  return () => forget(element);
}
