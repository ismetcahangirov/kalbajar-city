"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { LeadFormProps } from "@/components/leads/lead-form";
import { cx } from "@/lib/cx";

/**
 * `LeadForm` brings its own Redux store, which would weigh more than the rest
 * of the apartment page's own script (CLAUDE.md §5, JS per route). So its
 * script loads only when the form's place comes near the screen (scrolling,
 * or focus moving past it, brings it there). The place keeps the form's
 * height meanwhile, so nothing moves when it appears.
 */
const LeadForm = dynamic(() => import("@/components/leads/lead-form").then((m) => m.LeadForm), {
  ssr: false,
});

export function DeferredLeadForm({ className, ...props }: LeadFormProps) {
  const place = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = place.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={place} className={cx("min-h-lead-form", className)}>
      {near && <LeadForm {...props} />}
    </div>
  );
}
