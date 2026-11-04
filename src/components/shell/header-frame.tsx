"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { usePathname } from "@/i18n/navigation";
import { onScrollFrame } from "@/lib/motion/frame";
import { observeThemeAt } from "@/lib/shell/theme-observer";

/**
 * The fixed header element (A8–A10). It never hides. It takes the theme of
 * the section under its middle (`data-theme`, see observeThemeAt), and once
 * the page has scrolled past its height the frosted layer slides in
 * (`data-collapsed`), until the page is back within 10 px of the top. On
 * the home page (`data-home`) the wordmark fades in with the scroll, in CSS
 * (src/styles/shell.css). The attributes are written to the element, not
 * rendered, so a scroll or a theme change never re-renders the header.
 */
export function HeaderFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    return observeThemeAt(
      () => header.offsetHeight / 2,
      (theme) => header.setAttribute("data-theme", theme),
    );
  }, [pathname]);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    let height = header.offsetHeight;
    const onResize = () => (height = header.offsetHeight);
    window.addEventListener("resize", onResize);
    let collapsed = false;
    const stop = onScrollFrame((scrollY) => {
      const next = scrollY > height ? true : scrollY < 10 ? false : collapsed;
      if (next === collapsed) return;
      collapsed = next;
      header.toggleAttribute("data-collapsed", next);
    });
    return () => {
      stop();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <header
      ref={ref}
      data-site-header=""
      data-home={pathname === "/" ? "" : undefined}
      className="fixed inset-x-0 top-0 z-40 h-(--header-height)"
    >
      {children}
    </header>
  );
}
