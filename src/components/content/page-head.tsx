import type { ReactNode } from "react";

import { FadeUp } from "@/components/motion";
import { Heading, Text } from "@/components/ui";
import { cx } from "@/lib/cx";

/**
 * A content page's title and lead. It is above the fold, so it renders in
 * its final state; `FadeUp` only moves it when the page loads scrolled down.
 */
export function PageHead({
  title,
  lead,
  children,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <FadeUp className={cx("flex flex-col gap-4", className)}>
      <Heading as="h1" size="display">
        {title}
      </Heading>
      {lead && (
        <Text size="body-lg" tone="muted" className="max-w-(--container-prose)">
          {lead}
        </Text>
      )}
      {children}
    </FadeUp>
  );
}
