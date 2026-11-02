import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RichTextView } from "@/components/content/rich-text-view";
import { categoryParam, pageParam, pageWindow } from "@/lib/public/query";
import { localizeRichText, summary } from "@/lib/public/rich-text";
import { constructionUpdateCreateSchema, monthSchema } from "@/shared/content";
import {
  paragraphs,
  richTextMediaIds,
  safeHref,
  sanitizeRichText,
  type RichTextDoc,
  type RichTextNode,
} from "@/shared/rich-text";

const id = "0b4f8f0e-7d1a-4c55-9b9e-2f7a3c1d5e6f";

const text = (value: string, marks?: RichTextNode["marks"]): RichTextNode => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
});

const link = (href: unknown) => text("bax", [{ type: "link", attrs: { href } }]);

describe("safeHref", () => {
  it.each([
    "https://kalbajarcity.az/menziller",
    "http://example.com",
    "mailto:info@kalbajarcity.az",
    "tel:+994501234567",
    "/menziller/a-12",
    "/en/xeberler?sehife=2",
    "#plan",
    "?sehife=2",
  ])("keeps %s", (href) => {
    expect(safeHref(href)).toBe(href);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "\u0000javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.example/x",
    "/\\evil.example",
    "https://",
    "menziller",
    "",
    "   ",
    42,
    null,
    undefined,
    { href: "https://example.com" },
  ])("refuses %j", (href) => {
    expect(safeHref(href)).toBeNull();
  });

  it("trims surrounding space", () => {
    expect(safeHref("  https://example.com  ")).toBe("https://example.com");
  });
});

describe("sanitizeRichText", () => {
  it("maps the known nodes and marks", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [text("Başlıq")] },
        {
          type: "paragraph",
          content: [
            text("qalın", [{ type: "bold" }]),
            { type: "hardBreak" },
            text("maili", [{ type: "italic" }, { type: "underline" }]),
            link("https://example.com"),
          ],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [text("bir")] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [text("iki")] }] },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("üç")] }] }],
        },
        { type: "blockquote", content: [{ type: "paragraph", content: [text("sitat")] }] },
        { type: "image", attrs: { mediaId: id.toUpperCase() } },
      ],
    };
    expect(sanitizeRichText(doc)).toEqual([
      { type: "heading", level: 2, content: [{ type: "text", text: "Başlıq" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "qalın", bold: true },
          { type: "break" },
          { type: "text", text: "maili", italic: true },
          { type: "text", text: "bax", href: "https://example.com" },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [
          [{ type: "paragraph", content: [{ type: "text", text: "bir" }] }],
          [{ type: "paragraph", content: [{ type: "text", text: "iki" }] }],
        ],
      },
      {
        type: "list",
        ordered: true,
        start: 3,
        items: [[{ type: "paragraph", content: [{ type: "text", text: "üç" }] }]],
      },
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "sitat" }] }],
      },
      { type: "image", mediaId: id },
    ]);
  });

  it("keeps one h1 per page: level 1 becomes h2, deeper levels h3", () => {
    const heading = (level: number) => ({
      type: "heading",
      attrs: { level },
      content: [text(`h${level}`)],
    });
    const levels = sanitizeRichText({
      type: "doc",
      content: [heading(1), heading(2), heading(3), heading(4), heading(6)],
    }).map((block) => (block.type === "heading" ? block.level : null));
    expect(levels).toEqual([2, 2, 3, 3, 3]);
  });

  it("drops unknown nodes, empty blocks and bad image ids, and unlinks unsafe links", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        { type: "codeBlock", content: [text("rm -rf /")] },
        { type: "iframe", attrs: { src: "https://evil.example" } },
        { type: "paragraph" },
        { type: "paragraph", content: [text("   ")] },
        {
          type: "paragraph",
          content: [{ type: "mention", attrs: { id: "x" } }, link("javascript:alert(1)")],
        },
        { type: "image", attrs: { mediaId: "../../etc/passwd" } },
        { type: "image", attrs: { src: "https://evil.example/x.png" } },
        { type: "bulletList", content: [{ type: "paragraph", content: [text("not an item")] }] },
        { type: "heading", attrs: { level: 2 }, content: [] },
      ],
    };
    expect(sanitizeRichText(doc)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "bax" }] },
    ]);
  });

  it("cuts documents nested deeper than any article needs", () => {
    let node: RichTextNode = { type: "paragraph", content: [text("deep")] };
    for (let i = 0; i < 40; i++) node = { type: "blockquote", content: [node] };
    expect(sanitizeRichText({ type: "doc", content: [node] })).toEqual([]);
  });

  it("refuses anything that is not a document", () => {
    expect(sanitizeRichText(null)).toEqual([]);
    expect(sanitizeRichText({ type: "paragraph" } as unknown as RichTextDoc)).toEqual([]);
  });

  it("lists embedded images once, in order, wherever they are", () => {
    const other = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
    const blocks = sanitizeRichText({
      type: "doc",
      content: [
        { type: "image", attrs: { mediaId: id } },
        {
          type: "blockquote",
          content: [
            { type: "image", attrs: { mediaId: other } },
            { type: "image", attrs: { mediaId: id } },
          ],
        },
      ],
    });
    expect(richTextMediaIds(blocks)).toEqual([id, other]);
  });
});

describe("RichTextView", () => {
  const render = (doc: RichTextDoc) =>
    renderToStaticMarkup(
      createElement(RichTextView, {
        blocks: sanitizeRichText(doc),
        renderImage: (mediaId: string, key: string) =>
          createElement("img", { key, "data-media": mediaId, alt: "" }),
      }),
    );

  it("renders plain elements and never raw HTML", () => {
    const html = render({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 3 }, content: [text("Başlıq")] },
        { type: "paragraph", content: [text("<script>alert(1)</script>"), link("/menziller")] },
        { type: "paragraph", content: [link("https://example.com")] },
        { type: "paragraph", content: [link("javascript:alert(1)")] },
        { type: "image", attrs: { mediaId: id } },
      ],
    });
    expect(html).toContain("<h3");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="/menziller"');
    expect(html).toContain(
      'href="https://example.com" class="underline decoration-1 underline-offset-4" rel="noopener noreferrer"',
    );
    expect(html).not.toContain("javascript:");
    expect(html).toContain(`data-media="${id}"`);
  });

  it("renders ordered lists from their start", () => {
    const html = render({
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { start: 4 },
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [text("dörd")] }] },
          ],
        },
      ],
    });
    expect(html).toMatch(/^<ol start="4"[^>]*><li[^>]*><p><span>dörd<\/span><\/p><\/li><\/ol>$/);
  });
});

describe("localised rich text", () => {
  it("falls back to Azerbaijani when the translation is empty", () => {
    const field = {
      az: paragraphs("Salam"),
      en: { type: "doc" as const, content: [] },
      ru: paragraphs("Привет"),
    };
    expect(localizeRichText(field, "ru")).toMatchObject({ locale: "ru", fallback: false });
    expect(localizeRichText(field, "en")).toMatchObject({ locale: "az", fallback: true });
    expect(localizeRichText(field, "az")).toMatchObject({ locale: "az", fallback: false });
  });

  it("summarises the first paragraph at a word boundary", () => {
    expect(summary(sanitizeRichText(paragraphs("Qısa mətn.")))).toBe("Qısa mətn.");
    const long = "Kəlbəcərdə tikinti davam edir ".repeat(10).trim();
    const cut = summary(sanitizeRichText(paragraphs(long)), 60)!;
    expect(cut.length).toBeLessThanOrEqual(61);
    expect(cut.endsWith("…")).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
    expect(summary([])).toBeNull();
  });
});

describe("content query parameters", () => {
  it("reads ?sehife= as a page number from 1", () => {
    expect(pageParam(undefined)).toBe(1);
    expect(pageParam("3")).toBe(3);
    expect(pageParam(["2", "5"])).toBe(2);
    for (const bad of ["0", "-1", "2.5", "abc", "1e3", "", "9999999"]) {
      expect(pageParam(bad), bad).toBe(1);
    }
  });

  it("reads ?kateqoriya= as a known category or no filter", () => {
    const known = ["eksteryer", "interyer"];
    expect(categoryParam("interyer", known)).toBe("interyer");
    expect(categoryParam("yoxdur", known)).toBeNull();
    expect(categoryParam(undefined, known)).toBeNull();
    expect(categoryParam(["eksteryer", "interyer"], known)).toBe("eksteryer");
  });

  it("links the first, last and neighbouring pages", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, "gap", 10]);
  });
});

describe("construction update schema", () => {
  it("stores the month as its first day", () => {
    expect(monthSchema.parse("2026-09")).toBe("2026-09-01");
    expect(monthSchema.parse("2026-09-01")).toBe("2026-09-01");
    expect(monthSchema.safeParse("2026-13").success).toBe(false);
    expect(monthSchema.safeParse("2026-09-15").success).toBe(false);
  });

  it("refuses a file listed twice and a progress outside 0–100", () => {
    const base = { month: "2026-09", title: { az: "Sentyabr" }, progressPercent: 40 };
    expect(constructionUpdateCreateSchema.safeParse({ ...base, mediaIds: [id, id] }).success).toBe(
      false,
    );
    expect(
      constructionUpdateCreateSchema.safeParse({ ...base, progressPercent: 101 }).success,
    ).toBe(false);
    expect(constructionUpdateCreateSchema.parse(base).mediaIds).toEqual([]);
  });
});
