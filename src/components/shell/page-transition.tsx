"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { isDesktopMotion, prefersReducedMotion } from "@/lib/motion/env";
import { duration } from "@/lib/motion/tokens";

/** Waits so long for the new page's first images before the curtain lifts anyway. */
const IMAGE_WAIT = 1500;
/** And so long for the route itself, so a failed navigation never leaves the curtain down. */
const ROUTE_WAIT = 10_000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The link a click would follow client-side, or null to leave the click alone. */
function linkToFollow(event: MouseEvent): URL | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement)) return null;
  // Other windows, downloads, dialogs, and the language links (full loads).
  if (link.target && link.target !== "_self") return null;
  if (link.hasAttribute("download") || link.hasAttribute("hreflang")) return null;
  if (link.closest("[data-dialog-open], [data-no-transition]")) return null;
  const url = new URL(link.href);
  if (url.origin !== location.origin) return null;
  // Same page (an anchor, or the query only): no curtain.
  if (url.pathname === location.pathname) return null;
  // The console is another app.
  if (url.pathname.startsWith("/admin")) return null;
  return url;
}

/** The visible main heading of the page now shown (other routes stay hidden in the DOM). */
function mainHeading(): HTMLElement | null {
  for (const heading of document.querySelectorAll<HTMLElement>("main h1")) {
    if (heading.offsetParent !== null || heading.getClientRects().length > 0) return heading;
  }
  return null;
}

function focusHeading() {
  const heading = mainHeading();
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}

/** The new page's images in the viewport, decoded, or the time limit. */
async function firstImages(): Promise<void> {
  const images = [...document.querySelectorAll<HTMLImageElement>("main img")].filter((image) => {
    if (image.offsetParent === null) return false;
    const box = image.getBoundingClientRect();
    return box.bottom > 0 && box.top < window.innerHeight;
  });
  await Promise.race([Promise.allSettled(images.map((image) => image.decode())), wait(IMAGE_WAIT)]);
}

/**
 * The page transition (motion-system.md → Chrome, reference
 * pyzhevsky-pages.md §1.2). A click on a same-origin link that the router
 * would follow (`@/i18n/navigation` links; not a new tab, a modified click,
 * a download, a language link or a same-page anchor) is taken over on
 * desktop with motion allowed: the curtain wipes up over the page, the
 * router navigates, and once the new route has rendered and its first
 * images are decoded the curtain wipes off upward. Back and forward, touch,
 * narrow screens and reduced motion navigate as usual, with no curtain.
 *
 * After a click-started navigation, with or without the curtain, focus
 * moves to the new page's main heading.
 *
 * The curtain is decoration (`aria-hidden`) and renders on the server, so
 * no markup is created when it plays.
 */
export function PageTransition() {
  const t = useTranslations("Shell");
  const router = useRouter();
  const pathname = usePathname();
  const curtain = useRef<HTMLDivElement>(null);
  const arrived = useRef<(() => void) | null>(null);
  const clicked = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const url = linkToFollow(event);
      if (!url) return;
      clicked.current = true;
      const element = curtain.current;
      if (busy.current) {
        event.preventDefault();
        return;
      }
      if (!element || prefersReducedMotion() || !isDesktopMotion()) return;
      // Ours now: the Link sees defaultPrevented and leaves it.
      event.preventDefault();
      busy.current = true;
      void play(element, url);
    };

    const play = async (element: HTMLDivElement, url: URL) => {
      const reached = new Promise<void>((resolve) => (arrived.current = resolve));
      element.dataset.state = "in";
      await wait(duration.slow);
      element.dataset.state = "hold";
      router.push(url.pathname + url.search + url.hash);
      await Promise.race([reached, wait(ROUTE_WAIT)]);
      arrived.current = null;
      await firstImages();
      element.dataset.state = "out";
      await wait(duration.slow);
      delete element.dataset.state;
      busy.current = false;
    };

    // Capture on window runs before React's own listeners on the document.
    window.addEventListener("click", onClick, { capture: true });
    return () => window.removeEventListener("click", onClick, { capture: true });
  }, [router]);

  useEffect(() => {
    if (!clicked.current) return;
    clicked.current = false;
    // After the new page's commit: the curtain may lift, focus may move.
    requestAnimationFrame(() => {
      arrived.current?.();
      focusHeading();
    });
  }, [pathname]);

  return (
    <div
      ref={curtain}
      aria-hidden="true"
      data-page-curtain=""
      data-theme="dark"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      <div data-curtain-bg="" className="absolute inset-0 bg-(image:--gradient-curtain)" />
      <CurtainLines />
      <div data-curtain-front="" className="absolute inset-0">
        <CurtainLines />
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <span data-curtain-logo="" className="text-logo-lg text-(--t-primary) uppercase">
          {t("brand")}
        </span>
      </div>
    </div>
  );
}

function CurtainLines() {
  return (
    <div className="absolute inset-0">
      {[100 / 3, 200 / 3].map((left) => (
        <span
          key={left}
          data-grid-line=""
          className="absolute inset-y-0 w-(--grid-line-width) bg-(--t-line)"
          style={{ left: `${left}%` }}
        />
      ))}
    </div>
  );
}
