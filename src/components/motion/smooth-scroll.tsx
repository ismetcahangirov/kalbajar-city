"use client";

import { useEffect } from "react";

import { hasFinePointer, onReducedMotion, prefersReducedMotion } from "@/lib/motion/env";
import { allowVirtualScroll, attachLenis } from "@/lib/motion/frame";
import { smoothScroll } from "@/lib/motion/tokens";

/**
 * Inertial scrolling with Lenis on desktop pointers (motion-system.md →
 * Smooth scroll). Touch keeps native scrolling, and so does reduced motion.
 * Lenis is loaded only when it will run, and is driven by the shared frame
 * loop. Renders nothing.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion() || !hasFinePointer()) return;

    let cancelled = false;
    let stop: (() => void) | undefined;

    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({
        autoRaf: false,
        smoothWheel: true,
        lerp: smoothScroll.lerp,
        wheelMultiplier: smoothScroll.wheelMultiplier,
        // A route change lands at the top of the new page, not mid-glide.
        stopInertiaOnNavigate: true,
        // Wheel inside an open modal (the mobile menu) is not the page's.
        prevent: (node) => node.closest("dialog[open]") !== null,
        // The hero snap takes over wheel turns in the first viewport.
        virtualScroll: allowVirtualScroll,
      });
      const detach = attachLenis(lenis);

      // Same-page anchors glide too and clear the fixed header. A keyboard
      // activation (no pointer, detail 0) keeps the native jump, which also
      // moves focus: the skip link depends on it.
      const onClick = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0 || event.detail === 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (!(link instanceof HTMLAnchorElement) || !link.hash) return;
        const url = new URL(link.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname) return;
        const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (!target) return;
        event.preventDefault();
        const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
        lenis.scrollTo(target, { offset: -(offset || 0) });
        history.pushState(null, "", url.hash);
      };
      document.addEventListener("click", onClick);

      stop = () => {
        document.removeEventListener("click", onClick);
        detach();
        lenis.destroy();
      };
    });

    const stopReduced = onReducedMotion(() => stop?.());
    return () => {
      cancelled = true;
      stopReduced();
      stop?.();
      stop = undefined;
    };
  }, []);

  return null;
}
