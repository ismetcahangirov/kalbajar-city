"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { onShellDialogOpened } from "@/lib/shell/dialogs";

const loadForm = () => import("@/components/leads/lead-form").then((m) => m.LeadForm);

/**
 * The form and its Redux store weigh more than the whole shell, so they are
 * not part of the JS every page shares (CLAUDE.md §5): the chunk is fetched
 * when the pointer or focus reaches an inquiry trigger, and rendered when
 * the dialog first opens.
 */
const LeadForm = dynamic(loadForm, { ssr: false });

export function InquiryForm() {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const prefetch = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-dialog-open="inquiry"]')) {
        void loadForm();
      }
    };
    document.addEventListener("pointerover", prefetch, { passive: true });
    document.addEventListener("focusin", prefetch);
    const stop = onShellDialogOpened("inquiry", () => setOpened(true));
    return () => {
      document.removeEventListener("pointerover", prefetch);
      document.removeEventListener("focusin", prefetch);
      stop();
    };
  }, []);

  return opened ? (
    <LeadForm type="inquiry" labelledBy="inquiry-title" appearance="hairline" />
  ) : null;
}
