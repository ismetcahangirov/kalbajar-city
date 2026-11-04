/**
 * The home preloader's hand-off (#64 → #66). `Preloader`'s inline script
 * sets `<html data-preloader="on">` before the first paint when it covers
 * the page (first visit in the session, motion allowed); it turns to
 * `"out"` while the curtain fades and `"done"` after. Without the attribute
 * the preloader did not run (a repeat visit, reduced motion, no script) and
 * the hero must stay as the server rendered it.
 *
 * The hero intro (A1–A4) applies its start state while `preloaderCovers()`
 * and plays on `onPreloaderDone`.
 */
export const preloaderStorageKey = "kc-preloader-seen";
export const preloaderDoneEvent = "kc:preloader-done";

export function preloaderCovers(): boolean {
  const state = document.documentElement.dataset.preloader;
  return state === "on" || state === "out";
}

/** Runs `listener` once when the preloader has gone (now, if it already has). */
export function onPreloaderDone(listener: () => void): () => void {
  if (document.documentElement.dataset.preloader === "done") {
    listener();
    return () => {};
  }
  window.addEventListener(preloaderDoneEvent, listener, { once: true });
  return () => window.removeEventListener(preloaderDoneEvent, listener);
}

/**
 * Decides before the first paint, inline in the HTML. Kept as a string so
 * it runs without waiting for any bundle. The cookie lets the E2E suite
 * skip it.
 */
export const preloaderScript = `(function(){try{var d=document.documentElement;if(matchMedia("(prefers-reduced-motion: reduce)").matches||/(^|; )kc-skip-preloader=1/.test(document.cookie)||sessionStorage.getItem("${preloaderStorageKey}"))return;sessionStorage.setItem("${preloaderStorageKey}","1");d.dataset.preloader="on"}catch(e){}})()`;
