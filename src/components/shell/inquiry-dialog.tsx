import { X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { InquiryForm } from "./inquiry-form";

/**
 * The inquiry dialog (ui-kit.md → Chrome; reference pyzhevsky-pages.md §4,
 * request form): the right half of the screen on a sand panel, with the
 * 90 × 90 taupe close tab outside its top-left corner; full screen below lg.
 * The panel wipes in (src/styles/shell.css); the form inside never
 * animates. Rendered on the server and driven by `ShellDialogs`; the form
 * and its store load only when the dialog first opens (`InquiryForm`).
 *
 * Open it with `data-dialog-open="inquiry"` on any element, or
 * `openShellDialog("inquiry")` (src/lib/shell/dialogs.ts).
 */
export async function InquiryDialog() {
  const t = await getTranslations("Shell");
  const form = await getTranslations("LeadForm");
  return (
    <dialog
      id="inquiry"
      data-shell-dialog=""
      data-inquiry=""
      aria-labelledby="inquiry-title"
      className="[--inquiry-tab:5.625rem]"
    >
      <div data-inquiry-wipe="" className="pointer-events-none absolute inset-0">
        <div
          data-theme="sand"
          className="pointer-events-auto absolute inset-y-0 end-0 w-full overflow-y-auto bg-(--t-bg) text-(--t-text) [--t-small:var(--t-text)] lg:w-1/2"
        >
          <div
            data-inquiry-content=""
            className="mx-auto flex min-h-full max-w-[40rem] flex-col gap-u3 px-layout pt-[calc(var(--header-height)+var(--u)*4)] pb-u4 lg:pt-u6"
          >
            <div className="flex flex-col items-center gap-u text-center">
              <h2 id="inquiry-title" className="text-title text-(--t-heading) uppercase">
                {t("inquire")}
              </h2>
              <p className="max-w-(--container-prose) text-body">{form("intro.inquiry")}</p>
            </div>
            <InquiryForm />
          </div>
        </div>
        <button
          type="button"
          data-dialog-close=""
          data-dialog-initial=""
          aria-label={t("closeInquiry")}
          className="pointer-events-auto absolute end-0 top-0 grid size-[3.75rem] place-items-center bg-taupe text-cream-hover lg:end-1/2 lg:size-(--inquiry-tab)"
        >
          <X width={24} height={24} strokeWidth={1} aria-hidden focusable={false} />
        </button>
      </div>
    </dialog>
  );
}
