"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

import { interpolate } from "@/lib/motion/interpolate";

import { useScrub, type ScrubOptions } from "./use-scrub";

/** The properties a scrub may write (docs/motion-system.md → rule 1). */
export type ScrubStyle = Partial<
  Record<"translate" | "scale" | "rotate" | "transform" | "clipPath" | "opacity", string | number>
>;

type ScrubProps = Omit<ScrubOptions, "enabled"> & {
  as?: ElementType;
  /** The start state, at progress 0. Applied only by script, after hydration. */
  from: ScrubStyle;
  /** The end state, at progress 1. */
  to: ScrubStyle;
  className?: string;
  /**
   * The server's state: what shows without script, under reduced motion and
   * on touch, and what comes back when motion stops. Usually the final state.
   */
  style?: CSSProperties;
  children?: ReactNode;
  [data: `data-${string}`]: string | undefined;
  "aria-hidden"?: boolean | "true" | "false";
  id?: string;
};

const cssName = (property: string) => property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Declarative `useScrub`: interpolates each property from `from` to `to`
 * through the range and writes it inline, only when its value changed.
 * Lengths, `calc()`, `inset()` and `polygon()` interpolate term by term
 * (src/lib/motion/interpolate.ts); `from` and `to` need the same shape.
 * Nest two `Scrub`s for an effect with two ranges on one element.
 */
export function Scrub({
  as: Tag = "div",
  from,
  to,
  range,
  easing,
  trigger,
  clamp,
  mode,
  className,
  style,
  children,
  ...props
}: ScrubProps) {
  const ref = useRef<HTMLElement>(null);
  const key = JSON.stringify([from, to]);
  const tracks = useMemo(() => {
    const [start, end] = JSON.parse(key) as [ScrubStyle, ScrubStyle];
    return Object.keys(start).map((property) => {
      const name = property as keyof ScrubStyle;
      return { name: cssName(name), at: interpolate(start[name]!, end[name] ?? start[name]!) };
    });
  }, [key]);
  const written = useRef(new Map<string, string>());
  const serverStyle = useRef(style);
  useEffect(() => {
    serverStyle.current = style;
  });

  useScrub(
    ref,
    { range, easing, trigger, clamp, mode },
    (progress) => {
      const element = ref.current;
      if (!element) return;
      for (const { name, at } of tracks) {
        const value = at(progress);
        if (written.current.get(name) === value) continue;
        element.style.setProperty(name, value);
        written.current.set(name, value);
      }
    },
    () => {
      const element = ref.current;
      if (!element) return;
      for (const name of written.current.keys()) {
        const camel = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        const original = serverStyle.current?.[camel as keyof CSSProperties];
        if (original === undefined) element.style.removeProperty(name);
        else element.style.setProperty(name, String(original));
      }
      written.current.clear();
    },
  );

  return (
    <Tag ref={ref} data-scrub="" className={className} style={style} {...props}>
      {children}
    </Tag>
  );
}
