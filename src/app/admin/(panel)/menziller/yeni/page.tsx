import type { Metadata } from "next";
import { connection } from "next/server";

import { ApartmentForm } from "@/components/admin/apartments/apartment-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { apartmentFormOptions } from "@/lib/admin/apartments";
import { t } from "@/lib/admin/messages";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("apartments.newTitle") };

export const instant = false;

/** A new apartment, on a floor and with a layout that exist. */
export default async function NewApartmentPage() {
  await requireUser({ inventory: ["create"] });
  await connection();
  const { floors, layouts } = await apartmentFormOptions(getDb());
  return (
    <>
      <PageHeader title={t("apartments.newTitle")} />
      <ApartmentForm
        floors={floors}
        layouts={layouts}
        abilities={{ update: true, delete: false }}
      />
    </>
  );
}
