"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { ArrowBlock } from "@/components/ui/arrow-block";

type InteractiveMapProps = {
  /** The OpenStreetMap embed URL (`osmEmbedUrl`). */
  src: string;
  /** The frame's accessible name. */
  title: string;
  /** The button that loads the map. */
  label: string;
  /** What shows until then: the static map image, or the drawn ground and pin. */
  children?: ReactNode;
};

/**
 * Nothing third-party loads until the visitor asks for the map: the static
 * image (served with the site's media), or the drawn ground with the pin,
 * and a button stand in for it, and only the click puts the OpenStreetMap
 * frame on the page. Focus moves to the frame, so a keyboard user is not
 * left on a button that no longer exists.
 */
export function InteractiveMap({ src, title, label, children }: InteractiveMapProps) {
  const [open, setOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (open) frame.current?.focus();
  }, [open]);

  if (open) {
    return (
      <iframe
        ref={frame}
        src={src}
        title={title}
        loading="lazy"
        className="absolute inset-0 size-full border-0"
      />
    );
  }

  return (
    <>
      {children}
      <div className="absolute inset-x-0 bottom-0 flex justify-end p-u">
        <ArrowBlock tone="ink" onClick={() => setOpen(true)}>
          {label}
        </ArrowBlock>
      </div>
    </>
  );
}
