import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { RoundButton, type RoundButtonProps } from "@/components/ui/round-button";

type ArticleHeadProps = {
  title: ReactNode;
  /** `lang` of the title when it falls back to another locale. */
  lang?: string;
  /** The line under the title: the date. */
  meta?: ReactNode;
  /** The round back button, to the list the article belongs to. */
  back?: { href: Extract<RoundButtonProps, { as: "link" }>["href"]; label: string };
  id?: string;
};

/**
 * The head of an article (reference pyzhevsky-pages.md §3 `/news` article):
 * the 30 px round back button, the title in `--text-lead-lg` across about
 * two thirds of the page, the date as a caps label and a full-width 1 px
 * rule. On light; it does not move (motion-system.md → contact and privacy
 * pages allow reveals on heads only, and this one is above the fold).
 */
export function ArticleHead({ title, lang, meta, back, id = "sehife-basliq" }: ArticleHeadProps) {
  return (
    // It opens the page under the header, like a hero, so it brings its own
    // top padding (and the page's light theme for the header).
    <header
      data-theme="light"
      data-header-overlay=""
      className="flex flex-col gap-u3 border-b border-(--t-line) px-layout pt-[calc(var(--header-height)+var(--u)*2)] pb-u2 text-(--t-text) desk:gap-u4"
    >
      {back && (
        <RoundButton
          as="link"
          href={back.href}
          label={back.label}
          icon={
            <ArrowLeft width={16} height={16} strokeWidth={1.5} aria-hidden focusable={false} />
          }
          className="-ms-[0.4375rem]"
        />
      )}
      <h1
        id={id}
        lang={lang}
        className="max-w-[52rem] text-lead-lg wrap-break-word hyphens-auto text-(--t-text)"
      >
        {title}
      </h1>
      {meta && <p className="text-label text-(--t-small) uppercase">{meta}</p>}
    </header>
  );
}
