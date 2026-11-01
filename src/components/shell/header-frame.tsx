"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { usePathname } from "@/i18n/navigation";

/**
 * The fixed header element. On a page whose hero carries
 * `data-header-overlay`, the header starts transparent over it (CSS, so it is
 * right from the first paint and without JavaScript) and turns solid once the
 * hero has passed under it. Pages without a hero get the solid header.
 */
export function HeaderFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const header = ref.current;
    const hero = document.querySelector("[data-header-overlay]");
    if (!header || !hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSolid(entry ? !entry.isIntersecting : false),
      // The hero counts as gone once its bottom edge is under the header.
      { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <header
      ref={ref}
      data-site-header=""
      data-solid={solid ? "" : undefined}
      className="fixed inset-x-0 top-0 z-40 h-(--header-height) text-text"
    >
      <span
        aria-hidden="true"
        data-header-layer=""
        className="absolute inset-0 border-b border-border bg-surface transition-opacity duration-(--duration-fast) ease-standard"
      />
      {children}
    </header>
  );
}
