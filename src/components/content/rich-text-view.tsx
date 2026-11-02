import type { ReactNode } from "react";

import type { RichBlock, RichInline } from "@/shared/rich-text";

/** Renders a sanitised image block, or nothing when the file may not be shown. */
export type RenderImage = (mediaId: string, key: string) => ReactNode;

const link = "underline decoration-1 underline-offset-4";

/** External links leave without handing the page to the target (`noopener`) or the referrer. */
function external(href: string): boolean {
  return /^https?:/i.test(href);
}

function inlines(content: RichInline[]): ReactNode[] {
  return content.map((run, i) => {
    if (run.type === "break") return <br key={i} />;
    let node: ReactNode = run.text;
    if (run.italic) node = <em>{node}</em>;
    if (run.bold) node = <strong className="font-medium">{node}</strong>;
    if (run.href) {
      node = (
        <a
          href={run.href}
          className={link}
          {...(external(run.href) ? { rel: "noopener noreferrer" } : {})}
        >
          {node}
        </a>
      );
    }
    return <span key={i}>{node}</span>;
  });
}

function blocks(list: RichBlock[], renderImage: RenderImage, prefix: string): ReactNode[] {
  return list.map((block, i) => {
    const key = `${prefix}${i}`;
    switch (block.type) {
      case "paragraph":
        return <p key={key}>{inlines(block.content)}</p>;
      case "heading":
        return block.level === 2 ? (
          <h2 key={key} className="pt-4 text-heading text-balance">
            {inlines(block.content)}
          </h2>
        ) : (
          <h3 key={key} className="pt-2 text-title text-balance">
            {inlines(block.content)}
          </h3>
        );
      case "list": {
        const Tag = block.ordered ? "ol" : "ul";
        return (
          <Tag
            key={key}
            start={block.start}
            className={`flex flex-col gap-2 ps-6 ${block.ordered ? "list-decimal" : "list-disc"}`}
          >
            {block.items.map((item, j) => (
              // Not flex: a flex item loses its list marker.
              <li key={j} className="ps-1 [&>*+*]:mt-2">
                {blocks(item, renderImage, `${key}.${j}.`)}
              </li>
            ))}
          </Tag>
        );
      }
      case "blockquote":
        return (
          <blockquote
            key={key}
            className="flex flex-col gap-4 border-s-2 border-border-strong ps-6 text-body-lg text-text-muted"
          >
            {blocks(block.content, renderImage, `${key}.`)}
          </blockquote>
        );
      case "image":
        return renderImage(block.mediaId, key);
    }
  });
}

/**
 * The sanitised blocks of a rich-text field as plain elements: no HTML string
 * is ever injected. Images are rendered by the caller, which knows the files.
 */
export function RichTextView({
  blocks: content,
  renderImage,
}: {
  blocks: RichBlock[];
  renderImage: RenderImage;
}) {
  return <>{blocks(content, renderImage, "")}</>;
}
