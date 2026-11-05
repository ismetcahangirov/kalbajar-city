import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ContentNav } from "@/components/admin/content/content-nav";
import { HomeSectionsManager } from "@/components/admin/home/home-sections-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { layoutTypes } from "@/db/schema";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { groupLayouts } from "@/lib/public/layouts";

export const metadata: Metadata = { title: t("home.title") };

export const instant = false;

/** The home page's sections: order, visibility, copy, media, featured layouts (#17, #25). */
export default async function HomeSectionsPage() {
  const user = await requireUser(adminModules.news.permission);
  await connection();
  const layouts = await getDb()
    .select({
      rooms: layoutTypes.rooms,
      areaTotal: layoutTypes.areaTotal,
      planMediaId: layoutTypes.planMediaId,
    })
    .from(layoutTypes)
    .orderBy(asc(layoutTypes.rooms));
  const roomCounts = groupLayouts(layouts, () => null).map(({ rooms, plans }) => ({
    rooms,
    plans,
  }));
  return (
    <>
      <PageHeader title={t("home.title")} description={t("home.lead")} />
      <ContentNav current="home" />
      <HomeSectionsManager
        readOnly={!can(user.role, { content: ["update"] })}
        canUpload={can(user.role, { media: ["upload"] })}
        roomCounts={roomCounts}
      />
    </>
  );
}
