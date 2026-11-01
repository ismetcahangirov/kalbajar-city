"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { Container, Icon } from "@/components/ui";
import { usePathname } from "@/i18n/navigation";

import { ContactList } from "./contact-list";
import { NavLinks } from "./nav-links";
import { fullNav } from "./navigation";
import { BrandLink } from "./wordmark";

const FOCUSABLE = "a[href], button:not([disabled])";

const iconButton = "-me-2.5 grid size-target shrink-0 place-items-center rounded-full";

/**
 * The menu below `lg`: a full-screen modal `<dialog>` on `night`. Being
 * modal, it makes the page behind it inert, and Escape closes it natively,
 * returning focus to the menu button. Tab wraps from the last control to the
 * first, because a modal dialog alone lets focus leave for the browser's own
 * toolbar. It also closes on route change, on any link inside it, and when
 * the viewport grows to `lg`.
 */
export function MobileMenu() {
  const t = useTranslations("Shell");
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(width >= 64rem)");
    const onChange = () => {
      if (desktop.matches) dialog.current?.close();
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  function show() {
    dialog.current?.showModal();
    setOpen(true);
  }

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const stops = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = stops[0];
    const last = stops.at(-1);
    if (!first || !last) return;
    const edge = event.shiftKey ? first : last;
    if (document.activeElement === edge) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  function closeOnLink(event: MouseEvent<HTMLDialogElement>) {
    if (event.target instanceof Element && event.target.closest("a")) dialog.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={t("openMenu")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-menu"
        className={`${iconButton} lg:hidden`}
      >
        <Icon icon={Menu} size={24} />
      </button>
      <dialog
        id="mobile-menu"
        ref={dialog}
        data-tone="night"
        data-mobile-menu=""
        aria-label={t("menu")}
        onClose={() => setOpen(false)}
        onClick={closeOnLink}
        onKeyDown={trapFocus}
        className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-0 p-0 text-text backdrop:bg-transparent"
      >
        <div className="flex min-h-full flex-col">
          <Container className="flex h-(--header-height) shrink-0 items-center justify-between gap-4">
            <BrandLink />
            <button
              type="button"
              autoFocus
              onClick={() => dialog.current?.close()}
              aria-label={t("closeMenu")}
              className={iconButton}
            >
              <Icon icon={X} size={24} />
            </button>
          </Container>
          <Container className="flex flex-1 flex-col justify-between gap-block py-block">
            <NavLinks items={fullNav} variant="menu" />
            <div className="flex flex-col gap-6">
              <ContactList className="text-text-muted" />
              <LocaleSwitcher className="-ms-3" />
            </div>
          </Container>
        </div>
      </dialog>
    </>
  );
}
