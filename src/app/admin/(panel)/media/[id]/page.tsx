import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { MediaDetail } from "@/components/admin/media/media-detail";
import { getDb } from "@/db";
import { getMedia } from "@/lib/admin/media";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { HttpError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("media.detailTitle") };

export const instant = false;

/** One file of the library (#25): preview, focus point, texts, usages and delete. */
export default async function MediaItemPage({ params }: PageProps<"/admin/media/[id]">) {
  const user = await requireUser(adminModules.media.permission);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await connection();

  let item;
  try {
    item = await getMedia(getDb(), id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  return (
    <MediaDetail
      initial={item}
      permissions={{
        update: can(user.role, { media: ["update"] }),
        delete: can(user.role, { media: ["delete"] }),
        upload: can(user.role, { media: ["upload"] }),
      }}
    />
  );
}
