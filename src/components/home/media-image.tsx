import Image from "next/image";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui";
import { cx } from "@/lib/cx";
import type { PublicImage } from "@/lib/public/media";

type MediaImageProps = {
  image: PublicImage;
  /** `sizes` for the responsive candidates. */
  sizes: string;
  /** The hero poster: the LCP element, loaded eagerly at high priority. */
  priority?: boolean;
  className?: string;
};

/**
 * A library image filling its frame, cropped around its focus point. The
 * frame sets the aspect ratio, so nothing shifts. Generated images carry the
 * "Illustrative" chip (`CLAUDE.md` → Imagery).
 *
 * `unoptimized` until the media pipeline (#11) stores resized variants: the
 * bucket's host is per environment, and the optimiser would fetch originals.
 */
export function MediaImage({ image, sizes, priority = false, className }: MediaImageProps) {
  const t = useTranslations("Media");
  return (
    <>
      <Image
        src={image.src}
        width={image.width}
        height={image.height}
        alt={image.alt}
        sizes={sizes}
        priority={priority}
        unoptimized
        placeholder={image.blurDataURL ? "blur" : "empty"}
        blurDataURL={image.blurDataURL ?? undefined}
        className={cx("size-full object-cover", className)}
        style={{ objectPosition: image.position }}
      />
      {image.illustrative && (
        <Badge variant="illustrative" className="absolute start-3 bottom-3">
          {t("illustrative")}
        </Badge>
      )}
    </>
  );
}
