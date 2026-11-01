import type { ReactNode } from "react";

import { Container } from "@/components/ui";

import { LocaleSwitcher } from "./locale-switcher";

/**
 * Frames the placeholder pages until the site shell (#15) provides the header
 * with the locale switcher.
 */
export function PlaceholderFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <Container className="flex justify-end">
        <LocaleSwitcher />
      </Container>
      <main className="flex flex-1 flex-col justify-center py-section">
        <Container className="flex flex-col items-center gap-6 text-center">{children}</Container>
      </main>
    </>
  );
}
