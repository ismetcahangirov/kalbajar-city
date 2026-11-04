"use client";

import { useRef, type ReactNode } from "react";

import { useCursorFollower } from "@/components/motion/use-cursor-follower";
import { Link } from "@/i18n/navigation";

import type { StaticPath } from "./navigation";

/**
 * The teaser's link with the cursor-following "KEÇ" button (A35): on fine
 * pointers the 120 px circle follows the pointer over the teaser and fades
 * in and out with it; on touch, under reduced motion and without script it
 * stands centred below the title.
 */
export function NextChapterLink({
  href,
  label,
  go,
  children,
}: {
  href: StaticPath;
  label: string;
  go: string;
  children: ReactNode;
}) {
  const area = useRef<HTMLAnchorElement>(null);
  const follower = useRef<HTMLSpanElement>(null);
  useCursorFollower(area, follower);

  return (
    <Link
      ref={area}
      href={href}
      aria-label={label}
      className="relative isolate flex h-[18.75rem] flex-col items-center justify-end gap-u2 overflow-hidden px-layout pb-u4 desk:h-[30rem] desk:pb-u6"
    >
      {children}
      <span
        ref={follower}
        aria-hidden="true"
        data-follower=""
        className="grid size-[7.5rem] place-items-center rounded-full bg-cream text-label text-ink uppercase"
      >
        {go}
      </span>
    </Link>
  );
}
