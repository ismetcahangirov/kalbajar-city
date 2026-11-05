"use client";

import { ChevronUp } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { cx } from "@/lib/cx";

export type ChapterTab = {
  /** The id of the section on the page the tab leads to. */
  id: string;
  label: string;
};

type ChapterTabsProps = {
  tabs: ChapterTab[];
  /** The bar's accessible name, such as `Shell.sections`. */
  label: string;
};

/**
 * The bottom tab bar of a chapter page with in-page sections (ui-kit.md →
 * Tabs, reference pyzhevsky-pages.md §2.2): fixed at the bottom centre, ink,
 * caps labels; the tab of the section in the middle of the viewport is
 * active (1 px underline and `aria-current`). Below 668 px it is a dropdown
 * showing the active section. It fades out while the footer is in view and
 * rises above the locale suggestion. The tabs are anchors, so the sections
 * stay reachable without script; Lenis glides to them on desktop.
 *
 *   <ChapterTabs label={t("sections")} tabs={[{ id: "memarliq", label: "Memarlıq" }, …]} />
 */
export function ChapterTabs({ tabs, label }: ChapterTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [open, setOpen] = useState(false);
  const [overFooter, setOverFooter] = useState(false);
  const listId = useId();

  useEffect(() => {
    const sections = tabs
      .map((tab) => document.getElementById(tab.id))
      .filter((element): element is HTMLElement => element !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      // The section crossing the middle of the viewport.
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const section of sections) observer.observe(section);
    const footer = document.getElementById("site-footer");
    const footerObserver = new IntersectionObserver(([entry]) =>
      setOverFooter(entry?.isIntersecting ?? false),
    );
    if (footer) footerObserver.observe(footer);
    return () => {
      observer.disconnect();
      footerObserver.disconnect();
    };
  }, [tabs]);

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  if (!current) return null;

  const link = (tab: ChapterTab, className: string) => (
    <a
      href={`#${tab.id}`}
      aria-current={tab.id === active ? "location" : undefined}
      onClick={() => setOpen(false)}
      className={cx(
        "relative flex min-h-target items-center text-label whitespace-nowrap uppercase",
        tab.id === active
          ? "text-(--t-text) after:absolute after:inset-x-0 after:bottom-[calc(var(--u)/2)] after:h-px after:bg-current"
          : "text-(--t-small) hover:text-(--t-text)",
        className,
      )}
    >
      {tab.label}
    </a>
  );

  return (
    <nav
      aria-label={label}
      data-chapter-tabs=""
      data-theme="dark"
      data-over-footer={overFooter ? "" : undefined}
      // Faded out over the footer and out of the tab order at once, so the
      // keyboard never lands on a control that cannot be seen (WCAG 2.4.7).
      inert={overFooter}
      className="fixed inset-x-0 bottom-(--floating-bottom) z-30 flex justify-center px-layout"
    >
      <ul className="hidden divide-x divide-(--t-line-alt) bg-(--t-bg) desk:flex">
        {tabs.map((tab) => (
          <li key={tab.id}>{link(tab, "px-[2.1875rem]")}</li>
        ))}
      </ul>

      <div className="relative w-[12rem] max-w-full bg-(--t-bg) drop-shadow-button desk:hidden">
        {open && (
          <ul id={listId} className="absolute inset-x-0 bottom-full flex flex-col bg-(--t-bg) py-u">
            {tabs.map((tab) => (
              <li key={tab.id}>{link(tab, "px-u2")}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-target w-full items-center justify-between gap-u px-u2 text-label text-(--t-text) uppercase"
        >
          <span className="truncate">{current.label}</span>
          <ChevronUp
            width={16}
            height={16}
            strokeWidth={1.5}
            aria-hidden
            focusable={false}
            className={cx(
              "shrink-0 transition-transform duration-(--duration-normal)",
              !open && "rotate-180",
            )}
          />
        </button>
      </div>
    </nav>
  );
}
