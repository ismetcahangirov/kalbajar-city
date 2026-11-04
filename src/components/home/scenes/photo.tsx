import { Picture } from "@/components/ui/picture";
import type { Localized } from "@/i18n/content";
import { cx } from "@/lib/cx";
import type { PublicImage } from "@/lib/public/media";

type PhotoProps = {
  image: PublicImage;
  /** `sizes` for the responsive candidates: the frame's width per breakpoint. */
  sizes: string;
  /** The LCP image: requested eagerly at high priority. */
  priority?: boolean;
  className?: string;
};

/**
 * A scene's image filling its frame (the loader's image, else the slot's
 * bundled default). Generated defaults carry the "Illustrative" chip, which
 * `Picture` draws in the frame's corner.
 */
export function Photo({ image, sizes, priority, className }: PhotoProps) {
  return (
    <div className={cx("relative size-full overflow-hidden", className)}>
      <Picture image={image} sizes={sizes} priority={priority} />
    </div>
  );
}

/** `lang` for console text shown in its Azerbaijani fallback. */
export function langOf(text: Localized | null | undefined): string | undefined {
  return text?.fallback ? text.locale : undefined;
}

/** A full-bleed image's `sizes`. */
export const fullBleed = "100vw";
