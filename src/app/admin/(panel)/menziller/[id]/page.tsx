import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ApartmentForm } from "@/components/admin/apartments/apartment-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { apartmentFormOptions, getAdminApartment } from "@/lib/admin/apartments";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { HttpError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { apartmentIdParamsSchema } from "@/shared/apartments";

export const metadata: Metadata = { title: t("nav.apartments") };

export const instant = false;

/** One apartment: every field for inventory editors, the status for sales. */
export default async function ApartmentPage({ params }: PageProps<"/admin/menziller/[id]">) {
  const user = await requireUser(adminModules.apartments.permission);
  const parsed = apartmentIdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  await connection();
  const db = getDb();
  const apartment = await getAdminApartment(db, parsed.data.id).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  const { floors, layouts } = await apartmentFormOptions(db);
  return (
    <>
      <PageHeader
        title={t("apartments.editTitle", { name: `${apartment.block}-${apartment.number}` })}
      />
      <ApartmentForm
        apartment={apartment}
        floors={floors}
        layouts={layouts}
        abilities={{
          update: can(user.role, { inventory: ["update"] }),
          delete: can(user.role, { inventory: ["delete"] }),
        }}
      />
    </>
  );
}
