import { useTranslations } from "next-intl";

/** The first stop for keyboard users: jumps past the header to the content. */
export function SkipLink() {
  const t = useTranslations("Shell");
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:start-gutter focus:top-3 focus:z-50 focus:inline-flex focus:min-h-target focus:items-center focus:rounded-full focus:bg-surface-raised focus:px-5 focus:text-small focus:font-medium focus:shadow-raised"
    >
      {t("skip")}
    </a>
  );
}
