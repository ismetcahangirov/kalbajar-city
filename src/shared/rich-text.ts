import { z } from "zod";

/**
 * Rich text is stored as the editor's JSON document (the Tiptap/ProseMirror
 * shape Mebline uses), never as HTML, so it renders without
 * `dangerouslySetInnerHTML` and can be validated node by node later.
 */
export type RichTextMark = { type: string; attrs?: Record<string, unknown> };

export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
};

export type RichTextDoc = { type: "doc"; content?: RichTextNode[] };

/** A translatable rich-text field: `az` is required, like `Translatable`. */
export type TranslatableRichText = {
  az: RichTextDoc;
  en?: RichTextDoc | null;
  ru?: RichTextDoc | null;
};

const markSchema = z.object({
  type: z.string().min(1),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

const nodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.string().min(1),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(nodeSchema).optional(),
    marks: z.array(markSchema).optional(),
    text: z.string().optional(),
  }),
);

export const richTextDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(nodeSchema).optional(),
}) satisfies z.ZodType<RichTextDoc>;

export const translatableRichTextSchema = z.object({
  az: richTextDocSchema,
  en: richTextDocSchema.nullish(),
  ru: richTextDocSchema.nullish(),
}) satisfies z.ZodType<TranslatableRichText>;

/** A document of plain paragraphs, for seed data and tests. */
export function paragraphs(...texts: string[]): RichTextDoc {
  return {
    type: "doc",
    content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  };
}

/*
 * What the public site renders. `sanitizeRichText` keeps the node types the
 * site knows, in a closed shape, and drops everything else; pages render the
 * result with plain React elements, never with `dangerouslySetInnerHTML`.
 */

/** A run of text with its marks, or a line break inside a block. */
export type RichInline =
  { type: "text"; text: string; bold?: true; italic?: true; href?: string } | { type: "break" };

export type RichBlock =
  | { type: "paragraph"; content: RichInline[] }
  | { type: "heading"; level: 2 | 3; content: RichInline[] }
  | { type: "list"; ordered: boolean; start?: number; items: RichBlock[][] }
  | { type: "blockquote"; content: RichBlock[] }
  /** A library image, by id; the page looks up the file and drops it if it cannot be shown. */
  | { type: "image"; mediaId: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const linkSchemes = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Documents nested deeper than this are cut: no real article needs it. */
const maxDepth = 16;

/**
 * A link target that is safe to put in `href`, or null. Allowed: `http(s)`,
 * `mailto` and `tel` URLs, and site-relative paths (`/menziller`, `#plan`,
 * `?sehife=2`). Whitespace, control characters and backslashes are refused
 * outright, because browsers strip or reinterpret them (`java\tscript:`,
 * `/\evil.example`); so are protocol-relative `//host` links.
 */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href || href.length > 2048) return null;
  if (/[\s\u0000-\u001f\u007f\\]/.test(href)) return null;
  if (href.startsWith("/")) return href.startsWith("//") ? null : href;
  if (href.startsWith("#") || href.startsWith("?")) return href;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!linkSchemes.has(url.protocol)) return null;
  if ((url.protocol === "http:" || url.protocol === "https:") && !url.hostname) return null;
  return href;
}

function inlines(nodes: RichTextNode[] | undefined): RichInline[] {
  return (nodes ?? []).flatMap((node): RichInline[] => {
    if (node.type === "hardBreak") return [{ type: "break" }];
    if (node.type !== "text" || typeof node.text !== "string" || node.text === "") return [];
    const run: Extract<RichInline, { type: "text" }> = { type: "text", text: node.text };
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") run.bold = true;
      else if (mark.type === "italic") run.italic = true;
      else if (mark.type === "link") {
        const href = safeHref(mark.attrs?.href);
        if (href) run.href = href;
      }
      // Other marks (underline, code, colours) are dropped; their text stays.
    }
    return [run];
  });
}

function hasText(content: RichInline[]): boolean {
  return content.some((run) => run.type === "text" && run.text.trim() !== "");
}

function blocks(nodes: RichTextNode[] | undefined, depth: number): RichBlock[] {
  if (depth > maxDepth) return [];
  return (nodes ?? []).flatMap((node): RichBlock[] => {
    switch (node.type) {
      case "paragraph": {
        const content = inlines(node.content);
        return hasText(content) ? [{ type: "paragraph", content }] : [];
      }
      case "heading": {
        // The page has its own h1; deeper levels collapse to h3.
        const level = Number(node.attrs?.level) <= 2 ? 2 : 3;
        const content = inlines(node.content);
        return hasText(content) ? [{ type: "heading", level, content }] : [];
      }
      case "bulletList":
      case "orderedList": {
        const items = (node.content ?? [])
          .filter((item) => item.type === "listItem")
          .map((item) => blocks(item.content, depth + 1))
          .filter((item) => item.length > 0);
        if (!items.length) return [];
        const start = Number(node.attrs?.start);
        return [
          {
            type: "list",
            ordered: node.type === "orderedList",
            ...(node.type === "orderedList" && Number.isInteger(start) && start > 1
              ? { start }
              : {}),
            items,
          },
        ];
      }
      case "blockquote": {
        const content = blocks(node.content, depth + 1);
        return content.length ? [{ type: "blockquote", content }] : [];
      }
      case "image": {
        const mediaId = node.attrs?.mediaId;
        return typeof mediaId === "string" && uuid.test(mediaId)
          ? [{ type: "image", mediaId: mediaId.toLowerCase() }]
          : [];
      }
      default:
        return [];
    }
  });
}

/** The renderable part of a document: known nodes only, links made safe. */
export function sanitizeRichText(doc: RichTextDoc | null | undefined): RichBlock[] {
  return doc?.type === "doc" ? blocks(doc.content, 0) : [];
}

/** Whether a document shows anything once sanitised. */
export function hasRichContent(doc: RichTextDoc | null | undefined): boolean {
  return sanitizeRichText(doc).length > 0;
}

/** The library images a sanitised document shows, in order, without repeats. */
export function richTextMediaIds(content: RichBlock[]): string[] {
  const ids = new Set<string>();
  const visit = (list: RichBlock[]) => {
    for (const block of list) {
      if (block.type === "image") ids.add(block.mediaId);
      else if (block.type === "blockquote") visit(block.content);
      else if (block.type === "list") block.items.forEach(visit);
    }
  };
  visit(content);
  return [...ids];
}
