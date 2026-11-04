import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";

import { safeHref } from "@/shared/rich-text";

/**
 * A library image in the body: stored by `mediaId`, which is all the public
 * renderer reads (`sanitizeRichText`); `src` only draws it in the editor.
 * Block-level, because the site renders images as figures between paragraphs.
 */
const LibraryImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-media-id"),
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.mediaId === "string" ? { "data-media-id": attributes.mediaId } : {},
      },
    };
  },
}).configure({ inline: false });

/**
 * Only what the site renders (`RichBlock`): h2/h3, paragraphs, bold, italic,
 * links, lists, quotes and library images. Everything else would be dropped
 * on the site, so the editor does not offer it.
 */
export const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: {
      openOnClick: false,
      autolink: true,
      isAllowedUri: (url) => safeHref(url) !== null,
    },
  }),
  LibraryImage,
];
