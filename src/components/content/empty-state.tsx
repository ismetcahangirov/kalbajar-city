import type { ReactNode } from "react";

/** What a content page shows before anything is published: a hairline, a title, a line. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-u2 border-t border-(--t-line) pt-u4">
      <h2 className="text-title break-words hyphens-auto text-(--t-primary) uppercase">{title}</h2>
      <p className="max-w-(--container-prose) text-body">{body}</p>
      {action}
    </div>
  );
}
