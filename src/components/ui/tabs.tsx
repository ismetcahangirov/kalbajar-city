"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cx } from "@/lib/cx";

export type TabItem = {
  /** Stable key, unique within the tabs. */
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  /** The tab list's accessible name. */
  label: string;
  tabs: TabItem[];
  className?: string;
};

/**
 * The 50 px plan tabs of the apartment page (ui-kit.md → Tabs): equal tabs
 * in caps, the active one with a 1 px underline in the text colour, the
 * panels crossfading in one cell (motion-system.md → Tabs content). WAI-ARIA
 * tabs with automatic activation: arrows, Home and End move between tabs,
 * Tab goes into the panel. The server renders the first tab active, so the
 * page reads the same without JavaScript. The chapter tab bar is #64's.
 */
export function Tabs({ label, tabs, className }: TabsProps) {
  const base = useId();
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = (part: "tab" | "panel", index: number) => `${base}-${part}-${index}`;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? active === last
          ? 0
          : active + 1
        : event.key === "ArrowLeft"
          ? active === 0
            ? last
            : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div className={cx("flex flex-col", className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="grid auto-cols-fr grid-flow-col border-b border-(--t-line)"
      >
        {tabs.map((tab, index) => {
          const selected = index === active;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                refs.current[index] = element;
              }}
              id={id("tab", index)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={id("panel", index)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={cx(
                "-mb-px h-[3.125rem] border-b px-u text-label uppercase focus-visible:outline-offset-[-4px]",
                selected
                  ? "border-(--t-text) text-(--t-text)"
                  : "border-transparent text-(--t-small) hover:text-(--t-text)",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="grid">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            id={id("panel", index)}
            role="tabpanel"
            aria-labelledby={id("tab", index)}
            data-inactive={index === active ? undefined : ""}
            className="tabs__panel min-w-0"
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
