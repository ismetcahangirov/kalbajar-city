"use client";

import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion/env";
import type { PublicVideo } from "@/lib/public/media";

type NetworkInformation = { saveData?: boolean };

/**
 * The hero film over its poster. It never competes with the poster for LCP:
 * nothing downloads until the page has loaded, and it fades in only once it
 * can play through. It stays off with reduced motion and with Save-Data
 * (motion-system → Reduced motion).
 */
export function HeroVideo({ video }: { video: PublicVideo }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (!element || prefersReducedMotion() || connection?.saveData) return;

    const start = () => {
      element.src = video.src;
      element.addEventListener(
        "canplaythrough",
        () => {
          void element.play().then(
            () => element.setAttribute("data-ready", ""),
            () => {},
          );
        },
        { once: true },
      );
      element.load();
    };

    if (document.readyState === "complete") {
      start();
      return;
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, [video.src]);

  return (
    <video
      ref={ref}
      data-hero-video=""
      aria-hidden
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      className="absolute inset-0 size-full object-cover"
    />
  );
}
