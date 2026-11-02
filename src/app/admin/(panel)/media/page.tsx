import type { Metadata } from "next";

import { MediaLibrary } from "@/components/admin/media/media-library";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.media") };

export const instant = false;

/**
 * The media library (#25): uploads with progress, then every file as a grid
 * or a list. The list loads in the browser through RTK Query, with its
 * filters in the URL.
 */
export default async function MediaPage() {
  const user = await requireUser(adminModules.media.permission);
  return (
    <>
      <PageHeader title={t("nav.media")} description={t("module.media")} />
      <MediaLibrary canUpload={can(user.role, { media: ["upload"] })} />
    </>
  );
}
