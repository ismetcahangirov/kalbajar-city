import { Hammer } from "lucide-react";

import { t } from "@/lib/admin/messages";

import { PageHeader } from "./page-header";

/**
 * The page of a module a later issue builds (#24–#27): a real, guarded page,
 * so no menu link leads to a 404 in the meantime.
 */
export function ModuleComing({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border-strong p-6">
        <Hammer aria-hidden className="text-muted-foreground size-6" />
        <h2 className="font-medium">{t("module.comingTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("module.comingLead")}</p>
      </div>
    </>
  );
}
