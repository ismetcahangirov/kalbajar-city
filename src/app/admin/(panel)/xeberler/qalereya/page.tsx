import type { Metadata } from "next";

import { ContentNav } from "@/components/admin/content/content-nav";
import { GalleryManager } from "@/components/admin/content/gallery-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("gallery.title") };

export const instant = false;

/** The gallery: categories, their images and the order of both (#25). */
export default async function GalleryPage() {
  const user = await requireUser(adminModules.news.permission);
  return (
    <>
      <PageHeader title={t("gallery.title")} description={t("gallery.lead")} />
      <ContentNav current="gallery" />
      <GalleryManager
        abilities={{
          create: can(user.role, { content: ["create"] }),
          update: can(user.role, { content: ["update"] }),
          delete: can(user.role, { content: ["delete"] }),
          publish: can(user.role, { content: ["publish"] }),
          upload: can(user.role, { media: ["upload"] }),
        }}
      />
    </>
  );
}
