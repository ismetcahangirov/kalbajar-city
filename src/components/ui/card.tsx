import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export type Aspect = "grid" | "portrait" | "hero";

const aspectClass: Record<Aspect, string> = {
  grid: "aspect-grid",
  portrait: "aspect-portrait",
  hero: "aspect-hero",
};

type CardProps = {
  /** Leave it out for a text-only card (an article without a cover). */
  media?: ReactNode;
  aspect?: Aspect;
  title: string;
  /** Heading level of the title within the page outline. */
  titleAs?: "h2" | "h3" | "h4";
  meta?: ReactNode;
  chips?: ReactNode;
  /** When set, the whole card is one link; the title carries its name. */
  href?: string;
  className?: string;
};

export function Card({
  media,
  aspect = "grid",
  title,
  titleAs: Title = "h3",
  meta,
  chips,
  href,
  className,
}: CardProps) {
  return (
    <article className={cx("group relative flex flex-col gap-4", className)}>
      {media && (
        <div
          className={cx(
            "relative overflow-hidden rounded-md bg-surface-alt",
            "[&_img]:size-full [&_img]:object-cover",
            aspectClass[aspect],
          )}
        >
          {media}
        </div>
      )}
      {chips && <div className="flex flex-wrap gap-2">{chips}</div>}
      <div className="flex flex-col gap-1">
        <Title className="text-legacy-title text-text">
          {href ? (
            <Link
              href={href}
              className={cx(
                "underline-offset-4 group-hover:underline",
                // Stretch the link over the card; the ring draws on the overlay.
                "after:absolute after:inset-0 after:rounded-md focus-visible:outline-none",
                "focus-visible:after:outline-(length:--focus-ring-width) focus-visible:after:outline-offset-(--focus-ring-offset) focus-visible:after:outline-focus focus-visible:after:outline-solid",
              )}
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </Title>
        {meta && <div className="text-small text-text-muted">{meta}</div>}
      </div>
    </article>
  );
}
