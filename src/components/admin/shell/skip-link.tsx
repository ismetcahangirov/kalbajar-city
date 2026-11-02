import { t } from "@/lib/admin/messages";

/** The first stop for keyboard users: past the sidebar, to the page. */
export function SkipLink() {
  return (
    <a
      href="#content"
      className="bg-primary text-primary-foreground fixed top-2 left-2 z-50 -translate-y-20 rounded-md px-4 py-2 focus-visible:translate-y-0"
    >
      {t("panel.skipToContent")}
    </a>
  );
}
