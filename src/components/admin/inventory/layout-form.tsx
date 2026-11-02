"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";

import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { useUnsavedChangesGuard } from "@/components/admin/feedback/unsaved-changes";
import { SelectField, TextField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { FormAlert } from "@/components/admin/form-alert";
import { Button } from "@/components/admin/ui/button";
import { Form } from "@/components/admin/ui/form";
import { adminArea } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import {
  layoutTypeCreateSchema,
  roomKinds,
  type AdminLayoutType,
  type AdminPlan,
  type LayoutTypeCreate,
} from "@/shared/inventory";
import {
  useCreateLayoutTypeMutation,
  useDeleteLayoutTypeMutation,
  useUpdateLayoutTypeMutation,
} from "@/store/endpoints/admin-inventory";

import { inventoryPages } from "./inventory-nav";
import { MediaPicker } from "./media-picker";

const base = inventoryPages.layouts.href;

const typed = (area: string) => String(Number(area)).replace(".", ",");

const roomOptions = roomKinds.map((kind) => ({ value: kind, label: t(`room.${kind}`) }));

function valuesOf(layout: AdminLayoutType | undefined): LayoutTypeCreate {
  return {
    code: layout?.code ?? "",
    rooms: layout ? String(layout.rooms) : "",
    areaTotal: layout ? typed(layout.areaTotal) : "",
    roomAreas: (layout?.roomAreas ?? []).map((room) => ({
      kind: room.kind,
      area: typed(room.area),
    })),
    planMediaId: layout?.plan?.id ?? null,
    description: {
      az: layout?.description?.az ?? "",
      en: layout?.description?.en ?? "",
      ru: layout?.description?.ru ?? "",
    },
    sortOrder: String(layout?.sortOrder ?? 0),
  };
}

/** The sum of the breakdown as typed, or `null` while a value does not read as a number. */
function breakdownSum(rooms: Array<{ area?: unknown }> | undefined): number | null {
  let sum = 0;
  for (const room of rooms ?? []) {
    const value = Number(String(room.area ?? "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return null;
    sum += value;
  }
  return Math.round(sum * 100) / 100;
}

/**
 * A layout type: its code (what the CSV names it by), rooms, area, the
 * room-by-room breakdown, a translatable description and its plan image
 * from the media library.
 */
export function LayoutForm({
  layout,
  abilities,
}: {
  layout?: AdminLayoutType;
  abilities: { update: boolean; delete: boolean };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [create, { isLoading: creating }] = useCreateLayoutTypeMutation();
  const [update, { isLoading: updating }] = useUpdateLayoutTypeMutation();
  const [remove, { isLoading: removing }] = useDeleteLayoutTypeMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const [plan, setPlan] = useState<AdminPlan | null>(layout?.plan ?? null);
  const form = useAdminForm(layoutTypeCreateSchema, { defaultValues: valuesOf(layout) });
  const rooms = useFieldArray({ control: form.control, name: "roomAreas" });
  const roomValues = useWatch({ control: form.control, name: "roomAreas" });
  const sum = breakdownSum(roomValues);
  const busy = creating || updating || removing;
  const readOnly = !abilities.update;
  useUnsavedChangesGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful);

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      if (layout) {
        await update({ id: layout.id, ...values }).unwrap();
        form.reset(form.getValues());
        toast.success(t("layouts.saved"));
      } else {
        const created = await create(values).unwrap();
        toast.success(t("layouts.created"));
        router.push(`${base}/${created.id}`);
      }
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
  });

  const onDelete = async () => {
    if (!layout) return;
    const confirmed = await confirm({
      title: t("layouts.deleteTitle", { code: layout.code }),
      description: t("structure.deleteLead"),
      confirmLabel: t("layouts.delete"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove(layout.id).unwrap();
      form.reset(form.getValues());
      toast.success(t("layouts.deleted"));
      router.push(base);
    } catch (error) {
      toastApiError(error);
    }
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-5">
        <fieldset disabled={readOnly || busy} className="flex min-w-0 flex-col gap-5">
          <FormAlert message={alert} />
          <TextField<LayoutTypeCreate>
            name="code"
            label={t("layouts.code")}
            description={t("layouts.codeHint")}
            autoComplete="off"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField<LayoutTypeCreate>
              name="rooms"
              label={t("layouts.rooms")}
              inputMode="numeric"
              autoComplete="off"
            />
            <TextField<LayoutTypeCreate>
              name="areaTotal"
              label={t("layouts.area")}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>

          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="text-sm mb-2 font-medium">{t("layouts.breakdown")}</legend>
            {rooms.fields.length ? (
              <ol className="flex flex-col gap-3">
                {rooms.fields.map((field, index) => (
                  <li
                    key={field.id}
                    aria-label={t("layouts.roomLabel", { index: index + 1 })}
                    className="grid grid-cols-[1fr_8rem_auto] items-start gap-2"
                  >
                    <SelectField<LayoutTypeCreate>
                      name={`roomAreas.${index}.kind`}
                      label={t("layouts.roomKind")}
                      options={roomOptions}
                      disabled={readOnly}
                    />
                    <TextField<LayoutTypeCreate>
                      name={`roomAreas.${index}.area`}
                      label={t("layouts.roomArea")}
                      inputMode="decimal"
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6"
                      aria-label={t("layouts.removeRoom", {
                        room: t("layouts.roomLabel", { index: index + 1 }),
                      })}
                      onClick={() => rooms.remove(index)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{t("layouts.breakdownEmpty")}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => rooms.append({ kind: "bedroom", area: "" })}
              >
                <Plus aria-hidden />
                {t("layouts.addRoom")}
              </Button>
              {sum !== null && rooms.fields.length ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {t("layouts.breakdownSum", { sum: adminArea(String(sum)) })}
                </p>
              ) : null}
            </div>
          </fieldset>

          <TranslatableField<LayoutTypeCreate>
            name="description"
            label={t("layouts.description")}
            multiline
          />

          <MediaPicker
            label={t("layouts.plan")}
            value={plan}
            onChange={(next) => {
              setPlan(next);
              form.setValue("planMediaId", next?.id ?? null, { shouldDirty: true });
            }}
          />

          <TextField<LayoutTypeCreate>
            name="sortOrder"
            label={t("layouts.sortOrder")}
            description={t("layouts.sortOrderHint")}
            inputMode="numeric"
            autoComplete="off"
          />
        </fieldset>

        {readOnly ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy}>
              {layout
                ? updating
                  ? t("apartments.saving")
                  : t("apartments.save")
                : creating
                  ? t("apartments.creating")
                  : t("apartments.create")}
            </Button>
            {layout && abilities.delete ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive ml-auto"
                disabled={busy}
                onClick={() => void onDelete()}
              >
                <Trash2 aria-hidden />
                {t("layouts.delete")}
              </Button>
            ) : null}
          </div>
        )}
      </form>
    </Form>
  );
}
