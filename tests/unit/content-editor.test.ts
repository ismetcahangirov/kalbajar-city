import { getSchema } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { extensions } from "@/components/admin/content/rich-text-extensions";
import { bakuInputToIso, bakuInputValue } from "@/lib/admin/format";
import { missingRichLocales } from "@/lib/admin/translatables";
import { contentState, newsFormSchema } from "@/shared/content";
import { paragraphs, sanitizeRichText, type RichTextDoc } from "@/shared/rich-text";

const mediaId = "0b4f8f0e-7d1a-4c55-9b9e-2f7a3c1d5e6f";

describe("the console's rich-text editor", () => {
  it("writes documents the public renderer understands, node by node", () => {
    const schema = getSchema(extensions);
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Başlıq" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Alt" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Qalın", marks: [{ type: "bold" }] },
            { type: "text", text: " və " },
            { type: "text", text: "kursiv", marks: [{ type: "italic" }] },
            { type: "text", text: " ", marks: [] },
            {
              type: "text",
              text: "link",
              marks: [{ type: "link", attrs: { href: "/menziller" } }],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Bir" }] }],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "İki" }] }],
            },
          ],
        },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Sitat" }] }],
        },
        { type: "image", attrs: { src: "/x.webp", alt: "", mediaId } },
      ],
    });
    // The schema accepts the shape (nodeFromJSON throws otherwise), and the
    // stored JSON renders as the same structure on the site.
    doc.check();
    const blocks = sanitizeRichText(doc.toJSON() as RichTextDoc);
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "heading",
      "paragraph",
      "list",
      "list",
      "blockquote",
      "image",
    ]);
    expect(blocks[0]).toMatchObject({ level: 2 });
    expect(blocks[1]).toMatchObject({ level: 3 });
    expect(blocks[2]).toMatchObject({
      content: [
        { text: "Qalın", bold: true },
        { text: " və " },
        { text: "kursiv", italic: true },
        { text: " " },
        { text: "link", href: "/menziller" },
      ],
    });
    expect(blocks[4]).toMatchObject({ ordered: true });
    expect(blocks[6]).toEqual({ type: "image", mediaId });
  });

  it("offers nothing the site would drop", () => {
    const schema = getSchema(extensions);
    for (const name of ["codeBlock", "horizontalRule"]) expect(schema.nodes[name]).toBeUndefined();
    for (const name of ["code", "strike", "underline"]) expect(schema.marks[name]).toBeUndefined();
    expect(schema.nodes.image?.isBlock).toBe(true);
  });
});

describe("the article form", () => {
  const values = {
    slug: "",
    title: { az: "Başlıq", en: "", ru: "" },
    excerpt: { az: "", en: "", ru: "" },
    body: { az: paragraphs("Mətn") },
    coverMediaId: null,
  };

  it("makes a blank slug and a blank excerpt into none", () => {
    expect(newsFormSchema.parse(values)).toMatchObject({ slug: undefined, excerpt: null });
  });

  it("refuses an excerpt translated without its Azerbaijani text", () => {
    const result = newsFormSchema.safeParse({ ...values, excerpt: { az: "", en: "Lead" } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["excerpt", "az"]);
  });

  it("flags a body translation as missing until it shows anything", () => {
    const empty: RichTextDoc = { type: "doc", content: [{ type: "paragraph" }] };
    expect(missingRichLocales({ az: paragraphs("a"), en: empty, ru: paragraphs("b") })).toEqual([
      "en",
    ]);
  });
});

describe("publication states", () => {
  it("calls a draft with a date scheduled", () => {
    expect(contentState({ status: "draft", scheduledAt: null })).toBe("draft");
    expect(contentState({ status: "draft", scheduledAt: "2026-11-10T07:00:00.000Z" })).toBe(
      "scheduled",
    );
    expect(contentState({ status: "published", scheduledAt: null })).toBe("published");
  });

  it("reads the schedule picker in Baku time", () => {
    expect(bakuInputToIso("2026-11-10T11:00")).toBe("2026-11-10T07:00:00.000Z");
    expect(bakuInputValue("2026-11-10T07:00:00.000Z")).toBe("2026-11-10T11:00");
    expect(bakuInputToIso("10.11.2026 11:00")).toBeNull();
  });
});
