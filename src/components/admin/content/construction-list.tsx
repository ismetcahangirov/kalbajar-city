"use client";

import { locales } from "@/i18n/routing";
import { adminMonth, adminNumber } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import { missingLocales, missingRichLocales } from "@/lib/admin/translatables";
import type { AdminConstructionUpdate } from "@/shared/content";
import { useAdminConstructionUpdatesQuery } from "@/store/endpoints/admin-content";

import { ContentList, missingAcross } from "./content-list";
import { contentPages } from "./content-nav";

/** The construction updates, latest month first, filterable by state (#25). */
export function ConstructionList({ canCreate }: { canCreate: boolean }) {
  return (
    <ContentList<AdminConstructionUpdate>
      heading={t("construction.list")}
      empty={t("construction.empty")}
      baseHref={contentPages.construction.href}
      newLabel={t("construction.new")}
      canCreate={canCreate}
      useList={useAdminConstructionUpdatesQuery}
      titleOf={(item) => item.title.az}
      metaOf={(item) =>
        t("construction.meta", {
          month: adminMonth(item.month),
          percent: adminNumber(item.progressPercent),
        })
      }
      missingOf={(item) =>
        missingAcross(
          locales,
          missingLocales(item.title),
          item.body ? missingRichLocales(item.body) : [],
        )
      }
    />
  );
}
