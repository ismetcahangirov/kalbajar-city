"use client";

import { locales } from "@/i18n/routing";
import { t } from "@/lib/admin/messages";
import { missingLocales, missingRichLocales } from "@/lib/admin/translatables";
import type { AdminNews } from "@/shared/content";
import { useAdminNewsListQuery } from "@/store/endpoints/admin-content";

import { ContentList, missingAcross } from "./content-list";
import { contentPages } from "./content-nav";

/** The articles, newest first, filterable by state (#25). */
export function NewsList({ canCreate }: { canCreate: boolean }) {
  return (
    <ContentList<AdminNews>
      heading={t("news.list")}
      empty={t("news.empty")}
      baseHref={contentPages.news.href}
      newLabel={t("news.new")}
      canCreate={canCreate}
      useList={useAdminNewsListQuery}
      titleOf={(item) => item.title.az}
      missingOf={(item) =>
        missingAcross(
          locales,
          missingLocales(item.title),
          item.excerpt ? missingLocales(item.excerpt) : [],
          missingRichLocales(item.body),
        )
      }
    />
  );
}
