import { useTranslations } from "next-intl";

/** The first stop for keyboard users: jumps past the header to the content. */
export function SkipLink() {
  const t = useTranslations("Shell");
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:start-layout focus:top-u focus:z-[80] focus:inline-flex focus:min-h-target focus:items-center focus:bg-ink focus:px-u2 focus:text-label focus:text-cream focus:uppercase"
    >
      {t("skip")}
    </a>
  );
}
