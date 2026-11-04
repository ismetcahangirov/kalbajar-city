"use client";

import { useEffect, type RefObject } from "react";

import { prefersReducedMotion } from "@/lib/motion/env";
import { onFrame, onScrollFrame } from "@/lib/motion/frame";

/**
 * A decoration that follows the pointer over an area (A35, and the next-page
 * teaser's "KEÇ" button): fine pointers only, motion allowed. The area gets
 * `data-follow`, `data-state="in"` while the pointer is over it (the follower
 * fades in, src/styles/scenes.css) and `data-side="start"` or `"end"` for the
 * half it is in (a carousel's arrow direction). The follower is moved by
 * `transform` from where the caller placed it, in the shared frame loop; on
 * touch, under reduced motion and without script it stays there, visible.
 *
 * The follower must be `aria-hidden` decoration: the area's real control
 * (the link, the carousel buttons) carries the name and the focus.
 */
export function useCursorFollower(
  areaRef: RefObject<HTMLElement | null>,
  followerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const area = areaRef.current;
    const follower = followerRef.current;
    if (!area || !follower) return;
    if (!window.matchMedia("(pointer: fine)").matches || prefersReducedMotion()) return;

    area.dataset.follow = "";
    let areaBox: DOMRect | null = null;
    let rest = { x: 0, y: 0 };
    let written = { x: 0, y: 0 };
    let pointer = { x: 0, y: 0 };
    let queued = false;

    const write = () => {
      queued = false;
      const x = pointer.x - rest.x;
      const y = pointer.y - rest.y;
      if (x === written.x && y === written.y) return false;
      follower.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      written = { x, y };
      return false;
    };
    const track = (event: PointerEvent) => {
      // Read in the event, while layout is clean; invalidated on scroll.
      areaBox ??= area.getBoundingClientRect();
      pointer = { x: event.clientX - areaBox.left, y: event.clientY - areaBox.top };
      area.dataset.side = pointer.x < areaBox.width / 2 ? "start" : "end";
      if (!queued) {
        queued = true;
        onFrame(write);
      }
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      areaBox = area.getBoundingClientRect();
      const box = follower.getBoundingClientRect();
      // Where the follower's centre is at rest, without what was written.
      rest = {
        x: box.left + box.width / 2 - written.x - areaBox.left,
        y: box.top + box.height / 2 - written.y - areaBox.top,
      };
      track(event);
      area.dataset.state = "in";
    };
    const leave = () => {
      area.dataset.state = "out";
    };
    const stopScroll = onScrollFrame(() => {
      areaBox = null;
    });

    area.addEventListener("pointerenter", enter);
    area.addEventListener("pointermove", track);
    area.addEventListener("pointerleave", leave);
    return () => {
      area.removeEventListener("pointerenter", enter);
      area.removeEventListener("pointermove", track);
      area.removeEventListener("pointerleave", leave);
      stopScroll();
      delete area.dataset.follow;
      delete area.dataset.state;
      delete area.dataset.side;
      follower.style.removeProperty("transform");
    };
  }, [areaRef, followerRef]);
}
