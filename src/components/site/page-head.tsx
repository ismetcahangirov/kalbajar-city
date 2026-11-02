import type { ReactNode } from "react";

import { FadeUp } from "@/components/motion";
import { Container, Heading, Text } from "@/components/ui";

/**
 * The head of an inner page: the `h1` and its lead, on the page surface. The
 * only motion contact and privacy pages allow (motion-system.md → budget).
 */
export function PageHead({
  title,
  lead,
  meta,
}: {
  title: string;
  lead?: ReactNode;
  /** A line under the lead, such as the privacy notice's "last updated". */
  meta?: ReactNode;
}) {
  return (
    <div className="pt-section pb-block">
      <Container>
        <FadeUp className="flex flex-col gap-4">
          {/* Russian titles carry words longer than a 320 px screen at display size:
              hyphenate where the browser can, break the word where it cannot. */}
          <Heading
            as="h1"
            size="display"
            className="max-w-(--container-prose) wrap-break-word hyphens-auto"
          >
            {title}
          </Heading>
          {lead && (
            <Text size="body-lg" tone="muted" className="max-w-(--container-prose)">
              {lead}
            </Text>
          )}
          {meta && (
            <Text size="small" tone="muted">
              {meta}
            </Text>
          )}
        </FadeUp>
      </Container>
    </div>
  );
}
