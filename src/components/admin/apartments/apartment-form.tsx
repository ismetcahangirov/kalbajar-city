"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { z } from "zod";

import { SelectField, TextField } from "@/components/admin/form/fields";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { FormAlert } from "@/components/admin/form-alert";
import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { useUnsavedChangesGuard } from "@/components/admin/feedback/unsaved-changes";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/admin/ui/button";
import { Form } from "@/components/admin/ui/form";
import { adminArea, adminMoney } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import {
  apartmentFormSchema,
  toApartmentBody,
  type AdminApartment,
  type ApartmentFormValues,
} from "@/shared/apartments";
import { apartmentStatuses, minorToAzn } from "@/shared/inventory";
import {
  useCreateApartmentMutation,
  useDeleteApartmentMutation,
  useUpdateApartmentMutation,
} from "@/store/endpoints/admin-apartments";

const base = adminModules.apartments.href;

export type FloorOption = { id: string; block: string; number: number };
export type LayoutOption = { id: string; code: string; rooms: number; areaTotal: string };

const statusOptions = apartmentStatuses.map((status) => ({
  value: status,
  label: t(`status.${status}`),
}));

/** `62.00` → `62`, `62.09` → `62,09`: as a person types it. */
const typedArea = (area: string) => String(Number(area)).replace(".", ",");

function valuesOf(apartment: AdminApartment | undefined): ApartmentFormValues {
  return {
    floorId: apartment?.floorId ?? "",
    number: apartment?.number ?? "",
    layoutTypeId: apartment?.layoutTypeId ?? "",
    areaTotal: apartment ? typedArea(apartment.areaTotal) : "",
    status: apartment?.status ?? "available",
    price: minorToAzn(apartment?.priceMinor ?? null),
  };
}

/**
 * An apartment's form: every field for inventory editors, the status alone
 * for sales (`StatusForm`). Prices are typed in AZN and sent in qəpik.
 */
export function ApartmentForm({
  apartment,
  floors,
  layouts,
  abilities,
}: {
  apartment?: AdminApartment;
  floors: FloorOption[];
  layouts: LayoutOption[];
  abilities: { update: boolean; delete: boolean };
}) {
  if (apartment && !abilities.update) return <StatusForm apartment={apartment} />;
  return (
    <FullForm
      apartment={apartment}
      floors={floors}
      layouts={layouts}
      canDelete={abilities.delete}
    />
  );
}

function FullForm({
  apartment,
  floors,
  layouts,
  canDelete,
}: {
  apartment?: AdminApartment;
  floors: FloorOption[];
  layouts: LayoutOption[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [create, { isLoading: creating }] = useCreateApartmentMutation();
  const [update, { isLoading: updating }] = useUpdateApartmentMutation();
  const [remove, { isLoading: removing }] = useDeleteApartmentMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(apartmentFormSchema, { defaultValues: valuesOf(apartment) });
  const busy = creating || updating || removing;
  // Every successful save resets the form; a failed one leaves it dirty.
  useUnsavedChangesGuard(form.formState.isDirty);

  // Floors grouped by block, in the structure's order.
  const floorGroups = [...new Set(floors.map((floor) => floor.block))].map((block) => ({
    label: t("structure.blockName", { code: block }),
    options: floors
      .filter((floor) => floor.block === block)
      .map((floor) => ({
        value: floor.id,
        label: t("apartments.field.floorOption", { block, floor: floor.number }),
      })),
  }));
  const layoutOptions = layouts.map((layout) => ({
    value: layout.id,
    label: t("apartments.field.layoutOption", {
      code: layout.code,
      rooms: layout.rooms,
      area: adminArea(layout.areaTotal),
    }),
  }));

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    const body = toApartmentBody(values);
    try {
      if (apartment) {
        await update({ id: apartment.id, ...body }).unwrap();
        form.reset(form.getValues());
        toast.success(t("apartments.saved"));
      } else {
        const created = await create(body).unwrap();
        form.reset(form.getValues());
        toast.success(t("apartments.created"));
        router.push(`${base}/${created.id}`);
      }
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
  });

  const onDelete = async () => {
    if (!apartment) return;
    const name = `${apartment.block}-${apartment.number}`;
    const confirmed = await confirm({
      title: t("apartments.deleteTitle", { name }),
      description: t("apartments.deleteLead"),
      confirmLabel: t("apartments.delete"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove(apartment.id).unwrap();
      form.reset(form.getValues());
      toast.success(t("apartments.deleted"));
      router.push(base);
    } catch (error) {
      toastApiError(error);
    }
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-5">
        <FormAlert message={alert} />
        <SelectField<ApartmentFormValues>
          name="floorId"
          label={t("apartments.field.floor")}
          description={t("apartments.field.floorHint")}
          placeholder={t("apartments.field.choose")}
          options={floorGroups}
        />
        <TextField<ApartmentFormValues>
          name="number"
          label={t("apartments.field.number")}
          autoComplete="off"
        />
        <SelectField<ApartmentFormValues>
          name="layoutTypeId"
          label={t("apartments.field.layout")}
          placeholder={t("apartments.field.choose")}
          options={layoutOptions}
          onValueChange={(id) => {
            const layout = layouts.find((candidate) => candidate.id === id);
            if (layout && !form.getValues("areaTotal")) {
              form.setValue("areaTotal", typedArea(layout.areaTotal), { shouldDirty: true });
            }
          }}
        />
        <TextField<ApartmentFormValues>
          name="areaTotal"
          label={t("apartments.field.area")}
          description={t("apartments.field.areaHint")}
          inputMode="decimal"
          autoComplete="off"
        />
        <SelectField<ApartmentFormValues>
          name="status"
          label={t("apartments.field.status")}
          description={t("apartments.field.statusHint")}
          options={statusOptions}
        />
        <TextField<ApartmentFormValues>
          name="price"
          label={t("apartments.field.price")}
          description={t("apartments.field.priceHint")}
          inputMode="decimal"
          autoComplete="off"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy}>
            {apartment
              ? updating
                ? t("apartments.saving")
                : t("apartments.save")
              : creating
                ? t("apartments.creating")
                : t("apartments.create")}
          </Button>
          {apartment && canDelete ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive ml-auto"
              disabled={busy}
              onClick={() => void onDelete()}
            >
              <Trash2 aria-hidden />
              {t("apartments.delete")}
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}

const statusSchema = z.object({ status: z.enum(apartmentStatuses) });

/** What sales sees: the apartment's details, and its status as the one thing to change. */
function StatusForm({ apartment }: { apartment: AdminApartment }) {
  const [update, { isLoading }] = useUpdateApartmentMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(statusSchema, { defaultValues: { status: apartment.status } });
  useUnsavedChangesGuard(form.formState.isDirty);

  const onSubmit = form.handleSubmit(async ({ status }) => {
    setAlert(null);
    try {
      await update({ id: apartment.id, status }).unwrap();
      form.reset({ status });
      toast.success(t("apartments.saved"));
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
  });

  const facts: Array<[string, ReactNode]> = [
    [t("apartments.block"), apartment.block],
    [t("apartments.floor"), apartment.floor],
    [t("apartments.layout"), apartment.layout.code],
    [t("apartments.area"), adminArea(apartment.areaTotal)],
    [
      t("apartments.price"),
      apartment.priceMinor === null
        ? t("apartments.noPrice")
        : adminMoney(apartment.priceMinor, apartment.currency),
    ],
    [t("apartments.status"), <StatusBadge key="status" status={apartment.status} />],
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <dl className="bg-card grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-md border p-4">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">{t("apartments.salesOnly")}</p>
      <Form {...form}>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <FormAlert message={alert} />
          <SelectField<z.input<typeof statusSchema>>
            name="status"
            label={t("apartments.field.status")}
            description={t("apartments.field.statusHint")}
            options={statusOptions}
          />
          <div>
            <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
              {isLoading ? t("apartments.saving") : t("apartments.save")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
