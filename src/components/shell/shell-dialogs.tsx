"use client";

import { useEffect } from "react";

import { usePathname } from "@/i18n/navigation";
import { dialogOpenedEvent, openDialogEvent } from "@/lib/shell/dialogs";

import { isCurrent } from "./navigation";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), textarea, select";

function dialogById(id: string): HTMLDialogElement | null {
  const element = document.getElementById(id);
  return element instanceof HTMLDialogElement && element.hasAttribute("data-shell-dialog")
    ? element
    : null;
}

function setExpanded(id: string, expanded: boolean) {
  for (const trigger of document.querySelectorAll(`[data-dialog-open="${id}"][aria-expanded]`)) {
    trigger.setAttribute("aria-expanded", String(expanded));
  }
}

/**
 * Drives the shell's server-rendered `<dialog data-shell-dialog>`s (the
 * menu and the inquiry form) and marks the current page in the shell's
 * links. Renders nothing; the dialogs' markup costs no script.
 *
 * A dialog opens from any `[data-dialog-open="<id>"]` click or
 * `openShellDialog(id)`, as a modal: the page behind is inert. Focus goes to
 * its `[data-dialog-initial]` control and Tab wraps inside it; Escape, a
 * `[data-dialog-close]` button, a click on the backdrop, a link inside it or
 * a route change closes it, and focus returns to what opened it.
 */
export function ShellDialogs() {
  const pathname = usePathname();

  useEffect(() => {
    const openers = new Map<HTMLDialogElement, HTMLElement | null>();

    function open(id: string, opener: HTMLElement | null) {
      const dialog = dialogById(id);
      if (!dialog) return false;
      // One dialog at a time: the menu hands over to the inquiry form, and
      // focus later returns to what opened the first.
      let returnTo = opener;
      for (const other of document.querySelectorAll<HTMLDialogElement>(
        "dialog[data-shell-dialog][open]",
      )) {
        if (other === dialog) continue;
        returnTo = openers.get(other) ?? returnTo;
        openers.set(other, null);
        other.close();
      }
      if (!dialog.open) {
        openers.set(dialog, returnTo);
        dialog.showModal();
        setExpanded(id, true);
        // The first one shown: the menu has a close button per layout.
        [...dialog.querySelectorAll<HTMLElement>("[data-dialog-initial]")]
          .find((control) => control.getClientRects().length > 0)
          ?.focus();
        window.dispatchEvent(new CustomEvent(dialogOpenedEvent, { detail: id }));
      }
      return true;
    }

    function onClick(event: MouseEvent) {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const trigger = target.closest<HTMLElement>("[data-dialog-open]");
      if (trigger) {
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (open(trigger.dataset.dialogOpen ?? "", trigger)) event.preventDefault();
        return;
      }
      const dialog = target.closest<HTMLDialogElement>("dialog[data-shell-dialog][open]");
      if (!dialog) return;
      // The dialog element itself is the backdrop area around its panel. A
      // link leaves the page (even when the page transition took over the
      // click), except one opening a new tab (the consent's privacy link).
      const link = target.closest("a[href]");
      const leaves = link !== null && link.getAttribute("target") !== "_blank";
      if (target === dialog || target.closest("[data-dialog-close]") || leaves) {
        dialog.close();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLDialogElement>("dialog[data-shell-dialog][open]");
      if (!dialog) return;
      // A modal dialog alone lets focus leave for the browser's toolbar.
      const stops = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      const first = stops[0];
      const last = stops.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey ? active === first || active === dialog : active === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    function onClose(event: Event) {
      const dialog = event.target;
      if (!(dialog instanceof HTMLDialogElement) || !dialog.hasAttribute("data-shell-dialog")) {
        return;
      }
      setExpanded(dialog.id, false);
      const opener = openers.get(dialog);
      openers.delete(dialog);
      if (opener?.isConnected) opener.focus();
    }

    function onOpenEvent(event: Event) {
      const id = (event as CustomEvent<unknown>).detail;
      if (typeof id === "string") {
        open(id, document.activeElement instanceof HTMLElement ? document.activeElement : null);
      }
    }

    // Capture on window, before React's listeners on the document: a
    // trigger that is a `Link` must not navigate.
    window.addEventListener("click", onClick, { capture: true });
    document.addEventListener("keydown", onKeyDown);
    // `close` does not bubble; capture sees it on its way down.
    document.addEventListener("close", onClose, true);
    window.addEventListener(openDialogEvent, onOpenEvent);
    return () => {
      window.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("close", onClose, true);
      window.removeEventListener(openDialogEvent, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    // A route change closes whatever is open and marks the new page.
    for (const dialog of document.querySelectorAll<HTMLDialogElement>(
      "dialog[data-shell-dialog][open]",
    )) {
      dialog.close();
    }
    for (const link of document.querySelectorAll<HTMLElement>("[data-nav-href]")) {
      const current = isCurrent(pathname, link.dataset.navHref ?? "");
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }, [pathname]);

  return null;
}
