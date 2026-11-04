"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { usePathname } from "@/i18n/navigation";
import { observeThemeAt } from "@/lib/shell/theme-observer";

/** Themes the fixed buttons from the section under them and hides them over the footer. */
export function FixedButtonsFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const stopTheme = observeThemeAt(
      () => frame.getBoundingClientRect().top + frame.offsetHeight / 2,
      (theme) => frame.setAttribute("data-theme", theme),
    );
    const footer = document.getElementById("site-footer");
    const observer = new IntersectionObserver(([entry]) =>
      frame.toggleAttribute("data-over-footer", entry?.isIntersecting ?? false),
    );
    if (footer) observer.observe(footer);
    return () => {
      stopTheme();
      observer.disconnect();
    };
  }, [pathname]);

  return (
    <div
      ref={ref}
      data-fixed-buttons=""
      className="fixed end-0 bottom-(--floating-bottom) z-30 flex pe-[calc(var(--pad-layout)-7px)]"
    >
      {children}
    </div>
  );
}
