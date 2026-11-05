import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

import { cx } from "@/lib/cx";
import type { PublicImage } from "@/lib/public/media";

import { Badge } from "./badge";

type PictureProps = {
  image: PublicImage;
  /** `sizes` for the responsive candidates: how wide the frame is at each breakpoint. */
  sizes: string;
  /** The hero poster: the LCP element, loaded eagerly at high priority. */
  priority?: boolean;
  /**
   * `cover` fills the frame around the focus point. `contain` shows the whole
   * image, letterboxed (the lightbox): without the placeholder or the chip,
   * which would land on the empty bands; the caller shows the chip.
   */
  fit?: "cover" | "contain";
  className?: string;
};

/**
 * A library image filling its frame, cropped around its focus point (#11).
 * The browser picks the AVIF, else the WebP variant that fits `sizes`; the
 * pipeline already made them, so there is no image optimiser in between. The
 * frame sets the aspect ratio and `width`/`height` give the intrinsic one, so
 * nothing shifts. The blur placeholder, or the dominant colour, shows until
 * the file arrives. Illustrative images carry the chip (`CLAUDE.md` → Imagery).
 */
export function Picture({
  image,
  sizes,
  priority = false,
  fit = "cover",
  className,
}: PictureProps) {
  const t = useTranslations("Media");
  const contain = fit === "contain";
  // The centre is the default for `object-position`, and a page has dozens of
  // images: spelling it out in each one's HTML and payload adds up.
  const position = image.position === "50% 50%" ? undefined : image.position;
  const placeholder: CSSProperties = contain
    ? {}
    : image.blurDataURL
      ? {
          backgroundImage: `url("${image.blurDataURL}")`,
          ...(position && { backgroundPosition: position }),
        }
      : image.dominantColor
        ? { backgroundColor: image.dominantColor }
        : {};
  return (
    <>
      <picture className="contents">
        {image.sources.map((source) => (
          <source key={source.type} type={source.type} srcSet={source.srcSet} sizes={sizes} />
        ))}
        {/* Plain <img>: the variants are made at upload, not by next/image's optimiser. */}
        <img
          src={image.src}
          width={image.width}
          height={image.height}
          alt={image.alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding={priority ? "sync" : "async"}
          className={cx(
            "size-full bg-cover bg-center",
            contain ? "object-contain" : "object-cover",
            className,
          )}
          style={{ ...(position && { objectPosition: position }), ...placeholder }}
        />
      </picture>
      {image.illustrative && !contain && (
        <Badge variant="illustrative" className="absolute start-3 bottom-3">
          {t("illustrative")}
        </Badge>
      )}
    </>
  );
}
