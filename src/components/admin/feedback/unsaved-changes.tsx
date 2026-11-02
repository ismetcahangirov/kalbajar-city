"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { t } from "@/lib/admin/messages";

import { useConfirm } from "./confirm";

/** The in-app link a click would follow, or `null` for anything the guard leaves alone. */
export function guardedHref(event: MouseEvent, location: Location): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = event.target instanceof Element ? event.target : null;
  const anchor = target?.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, location.href);
  // Other sites are covered by beforeunload; a hash on this page loses nothing.
  if (url.origin !== location.origin) return null;
  if (url.pathname === location.pathname && url.search === location.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * While `dirty`, asks before the user leaves the page: the browser's own
 * prompt on reload, close and external links (beforeunload), and the
 * console's confirm dialog on in-app links, which are client-side navigations
 * beforeunload never sees.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const confirm = useConfirm();
  const router = useRouter();

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    // Capture phase on the document runs before Next's <Link> handler.
    const onClick = (event: MouseEvent) => {
      const href = guardedHref(event, window.location);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      void confirm({
        title: t("form.unsavedTitle"),
        description: t("form.unsavedLead"),
        confirmLabel: t("form.unsavedLeave"),
        cancelLabel: t("form.unsavedStay"),
        destructive: true,
      }).then((leave) => {
        if (leave) router.push(href);
      });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, confirm, router]);
}
