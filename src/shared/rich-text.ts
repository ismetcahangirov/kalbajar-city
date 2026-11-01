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
