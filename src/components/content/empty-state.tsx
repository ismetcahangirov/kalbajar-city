import type { ReactNode } from "react";

import { Heading, Text } from "@/components/ui";

/** What a content page shows before anything is published. */
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
    <div className="flex flex-col items-start gap-4 border-t border-border pt-block">
      <Heading as="h2" size="heading">
        {title}
      </Heading>
      <Text tone="muted" className="max-w-(--container-prose)">
        {body}
      </Text>
      {action}
    </div>
  );
}
