import { Button } from "@/components/ui/button";
import { t } from "@/lib/admin/messages";
import { adminPaths } from "@/lib/auth/paths";

export default function Forbidden() {
  return (
    <main className="flex min-h-svh flex-col items-start justify-center gap-4 px-gutter py-section sm:items-center sm:text-center">
      <h1 className="text-legacy-title">{t("forbidden.title")}</h1>
      <p className="text-text-muted">{t("forbidden.lead")}</p>
      <Button href={adminPaths.home} variant="secondary">
        {t("forbidden.back")}
      </Button>
    </main>
  );
}
