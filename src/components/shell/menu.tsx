import { X } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ArrowBlock } from "@/components/ui/arrow-block";
import { Picture } from "@/components/ui/picture";
import { defaultImage } from "@/content/defaults";
import { contacts, mainPhone, whatsappHref } from "@/config/contacts";
import { formatPhone, telHref } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import {
  chapterImage,
  chapters,
  menuCards,
  menuSmallLinks,
  privacyLink,
  type ChapterHref,
} from "./navigation";
import { RollLink } from "./roll-link";
import { BrandLink } from "./wordmark";

const closeClass =
  "relative grid size-target place-items-center text-cream before:absolute before:inset-[0.4375rem] before:bg-taupe";

function Close({ label }: { label: string }) {
  return (
    <button
      type="button"
      data-dialog-close=""
      data-dialog-initial=""
      aria-label={label}
      className={closeClass}
    >
      <X
        width={20}
        height={20}
        strokeWidth={1}
        aria-hidden
        focusable={false}
        className="relative"
      />
    </button>
  );
}

/**
 * The site menu: a modal `<dialog>` rendered on the server, driven by
 * `ShellDialogs` (no script of its own). From lg, a 540 px cream panel
 * unrolls from the top over a 50 % ink backdrop with the header's copy, a
 * row of image cards, one per chapter (its `page.*` image), and small links
 * below; the cards the pointer is not on turn sepia. Below lg it fills the
 * screen: two `ArrowBlock`s, the chapters as large links, contacts and the
 * languages.
 *
 * Images are the bundled `page.*` defaults until the console can set them.
 */
export async function Menu() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Shell");
  const nav = await getTranslations("Navigation");
  const phone = formatPhone(mainPhone);

  return (
    <dialog
      id="site-menu"
      data-shell-dialog=""
      data-menu=""
      aria-label={t("menu")}
      className="text-(--t-text)"
    >
      <div
        data-menu-panel=""
        data-theme="light"
        className="flex h-full flex-col overflow-y-auto bg-(--t-bg) lg:h-[33.75rem] lg:overflow-hidden"
      >
        {/* From lg: the header's row, then the cards, then the small links. */}
        <div className="hidden h-(--header-height) shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-u2 px-layout lg:grid">
          <div className="flex items-center gap-u3">
            <Close label={t("closeMenu")} />
            <RollLink href="/menziller" label={t("chooseApartment")} data-nav-href="/menziller" />
          </div>
          <BrandLink />
          <div className="flex items-center justify-end gap-u2">
            <RollLink
              as="a"
              href={telHref(mainPhone)}
              data-track="click_call"
              label={phone}
              className="hidden xl:inline-flex"
            />
            <RollLink href="/elaqe" label={t("inquire")} data-dialog-open="inquiry" />
            <LocaleSwitcher className="-me-3" />
          </div>
        </div>

        <nav
          aria-label={nav("label")}
          className="hidden flex-1 flex-col justify-between px-layout pb-u lg:flex"
        >
          <ul data-menu-cards="" className="my-auto flex gap-u">
            {menuCards.map(({ key, href }) => (
              <li key={key} data-menu-card="" data-menu-item="" className="min-w-0 flex-1">
                <Link href={href} data-nav-href={href} className="group flex flex-col gap-u">
                  <MenuCardImage href={href as ChapterHref} locale={locale} />
                  <span className="flex min-h-target items-center text-label text-(--t-text) uppercase group-aria-[current=page]:underline group-aria-[current=page]:underline-offset-4">
                    {nav(key)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div data-menu-item="" className="flex items-center justify-between gap-u2">
            <div className="flex items-center gap-u2">
              {menuSmallLinks.map(({ key, href }) => (
                <RollLink key={key} href={href} label={nav(key)} data-nav-href={href} />
              ))}
            </div>
            <div className="flex items-center gap-u2">
              {contacts.whatsapp && (
                <RollLink
                  as="a"
                  href={whatsappHref(contacts.whatsapp, t("whatsappMessage"))}
                  data-track="click_whatsapp"
                  rel="noopener noreferrer"
                  label={t("whatsapp")}
                />
              )}
              <RollLink
                as="a"
                href={contacts.instagram}
                rel="noopener noreferrer"
                label={t("instagram")}
              />
              <RollLink
                href={privacyLink.href}
                label={nav(privacyLink.key)}
                data-nav-href={privacyLink.href}
              />
            </div>
          </div>
        </nav>

        {/* Below lg: the full-screen list. */}
        <div className="flex h-(--header-height) shrink-0 items-center justify-between px-layout lg:hidden">
          <BrandLink />
          <Close label={t("closeMenu")} />
        </div>
        <div className="flex flex-1 flex-col gap-u4 pb-(--safe-bottom) lg:hidden">
          <div data-menu-item="" className="grid grid-cols-2 border-y border-(--t-line)">
            <ArrowBlock as="link" href="/menziller" className="h-[7.5rem]! w-full!">
              {t("chooseApartment")}
            </ArrowBlock>
            <ArrowBlock
              as="a"
              href="/elaqe"
              data-dialog-open="inquiry"
              className="h-[7.5rem]! w-full! border-s border-(--t-line)"
            >
              {t("inquire")}
            </ArrowBlock>
          </div>
          <nav aria-label={nav("label")} className="px-layout">
            <ul className="flex flex-col">
              {chapters.slice(1).map(({ key, href }) => (
                <li
                  key={key}
                  data-menu-item=""
                  className="border-b border-(--t-line) last:border-b-0"
                >
                  <Link
                    href={href}
                    data-nav-href={href}
                    className="flex min-h-target items-center py-u text-title uppercase aria-[current=page]:underline aria-[current=page]:decoration-1 aria-[current=page]:underline-offset-4"
                  >
                    {nav(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div data-menu-item="" className="mt-auto flex flex-col gap-u px-layout">
            <ul className="flex flex-col">
              <li>
                <RollLink as="a" href={telHref(mainPhone)} data-track="click_call" label={phone} />
              </li>
              {contacts.whatsapp && (
                <li>
                  <RollLink
                    as="a"
                    href={whatsappHref(contacts.whatsapp, t("whatsappMessage"))}
                    data-track="click_whatsapp"
                    rel="noopener noreferrer"
                    label={t("whatsapp")}
                  />
                </li>
              )}
              <li>
                <RollLink
                  as="a"
                  href={contacts.instagram}
                  rel="noopener noreferrer"
                  label={t("instagram")}
                />
              </li>
              <li>
                <RollLink
                  href={privacyLink.href}
                  label={nav(privacyLink.key)}
                  data-nav-href={privacyLink.href}
                />
              </li>
            </ul>
            <LocaleSwitcher className="-ms-3" />
          </div>
        </div>
      </div>
    </dialog>
  );
}

/**
 * A card's 2 : 1 image, decorative (the label names the link), with its
 * sepia twin: the same file, grayscale, screened over the sepia tile, shown
 * by opacity on the cards the pointer is not on.
 */
function MenuCardImage({ href, locale }: { href: ChapterHref; locale: Locale }) {
  const image = { ...defaultImage(chapterImage(href), locale), alt: "" };
  const sizes = "(width >= 64rem) 16vw, 1px";
  return (
    <span className="relative block aspect-[2/1] overflow-hidden">
      <Picture image={image} sizes={sizes} />
      <span aria-hidden="true" data-menu-sepia="" className="absolute inset-0 bg-sepia">
        <Picture image={{ ...image, blurDataURL: null, dominantColor: null }} sizes={sizes} />
      </span>
    </span>
  );
}
