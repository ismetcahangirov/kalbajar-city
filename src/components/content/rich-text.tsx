import { Picture } from "@/components/ui";
import { cx } from "@/lib/cx";
import type { PublicRichText } from "@/lib/public/rich-text";

import { RichTextView } from "./rich-text-view";

/**
 * An article or update body (#21). Text in a fallback language carries its
 * `lang`; an embedded image the library may not show (no alt text) is left
 * out, like everywhere else.
 */
export function RichText({ text, className }: { text: PublicRichText; className?: string }) {
  return (
    <div
      lang={text.fallback ? text.locale : undefined}
      className={cx("flex flex-col gap-5 text-body text-pretty", className)}
    >
      <RichTextView
        blocks={text.blocks}
        renderImage={(mediaId, key) => {
          const image = text.images[mediaId];
          if (!image) return null;
          return (
            <figure
              key={key}
              className="relative my-2 overflow-hidden rounded-md bg-surface-alt"
              style={{ aspectRatio: `${image.width} / ${image.height}` }}
            >
              <Picture image={image} sizes="(min-width: 44rem) 40rem, 100vw" />
            </figure>
          );
        }}
      />
    </div>
  );
}
