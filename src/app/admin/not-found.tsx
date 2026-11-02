import { Button } from "@/components/ui/button";
import { t } from "@/lib/admin/messages";
import { adminPaths } from "@/lib/auth/paths";

/** A console record or page that does not exist, e.g. a removed lead. */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-start justify-center gap-4 px-gutter py-section sm:items-center sm:text-center">
      <h1 className="text-title">{t("notFound.title")}</h1>
      <p className="text-text-muted">{t("error.notFound")}</p>
      <Button href={adminPaths.home} variant="secondary">
        {t("forbidden.back")}
      </Button>
    </main>
  );
}
