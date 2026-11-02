"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { DataTable, type ListResult } from "@/components/admin/data-table/data-table";
import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { SelectField, TextField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { FormAlert } from "@/components/admin/form-alert";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Form } from "@/components/admin/ui/form";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { t } from "@/lib/admin/messages";
import {
  blockCreateSchema,
  buildingCreateSchema,
  floorCreateSchema,
  type AdminBlock,
  type AdminBuilding,
  type AdminFloor,
  type AdminPlan,
  type BlockCreate,
  type BuildingCreate,
  type FloorCreate,
} from "@/shared/inventory";
import type { Page } from "@/shared/api";
import {
  useBlocksQuery,
  useBuildingsQuery,
  useCreateBlockMutation,
  useCreateBuildingMutation,
  useCreateFloorMutation,
  useDeleteBlockMutation,
  useDeleteBuildingMutation,
  useDeleteFloorMutation,
  useFloorsQuery,
  useUpdateBlockMutation,
  useUpdateBuildingMutation,
  useUpdateFloorMutation,
} from "@/store/endpoints/admin-inventory";

import { MediaPicker } from "./media-picker";

export type StructureAbilities = { create: boolean; update: boolean; delete: boolean };

/** A whole, unpaginated list as the one page `DataTable` shows. */
function asPage<T>(items: T[] | undefined): Page<T> | undefined {
  return items && { items, page: 1, pageSize: items.length, total: items.length, pageCount: 1 };
}

function adapt<T>(result: Omit<ListResult<T>, "data"> & { data?: T[] }): ListResult<T> {
  return { ...result, data: asPage(result.data) };
}

const useBuildingList = () => adapt(useBuildingsQuery());
const useBlockList = () => adapt(useBlocksQuery());
const useFloorList = (params: { block: string }) =>
  adapt(useFloorsQuery(params, { skip: !params.block }));

const demoBadge = (isDemo: boolean) =>
  isDemo ? (
    <Badge variant="outline" title={t("apartments.demoHint")}>
      {t("apartments.demo")}
    </Badge>
  ) : null;

/** Edit and delete buttons for a row, named after it. */
function RowActions({
  name,
  abilities,
  onEdit,
  onDelete,
}: {
  name: string;
  abilities: StructureAbilities;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="inline-flex gap-1">
      {abilities.update ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("structure.edit", { name })}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
      ) : null}
      {abilities.delete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("structure.delete", { name })}
          onClick={onDelete}
        >
          <Trash2 aria-hidden />
        </Button>
      ) : null}
    </span>
  );
}

function useRemove() {
  const confirm = useConfirm();
  return async (name: string, run: () => Promise<unknown>) => {
    const confirmed = await confirm({
      title: t("structure.deleteTitle", { name }),
      description: t("structure.deleteLead"),
      confirmLabel: t("structure.delete", { name }),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await run();
      toast.success(t("structure.deleted"));
    } catch (error) {
      toastApiError(error);
    }
  };
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-medium">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Buildings, blocks and floors: the structure every apartment hangs from.
 * Each is edited in a dialog; a delete that would orphan rows is refused by
 * the API with what still depends on it.
 */
export function Structure({ abilities }: { abilities: StructureAbilities }) {
  const buildings = useBuildingsQuery();
  const blocks = useBlocksQuery();
  const [block, setBlock] = useState("");
  const [editing, setEditing] = useState<
    | { kind: "building"; item?: AdminBuilding }
    | { kind: "block"; item?: AdminBlock }
    | { kind: "floor"; item?: AdminFloor }
    | null
  >(null);
  const remove = useRemove();
  const [deleteBuilding] = useDeleteBuildingMutation();
  const [deleteBlock] = useDeleteBlockMutation();
  const [deleteFloor] = useDeleteFloorMutation();
  const blockSelectId = useId();

  const buildingName = useMemo(() => {
    const names = new Map((buildings.data ?? []).map((item) => [item.id, item.name.az]));
    return (id: string) => names.get(id) ?? "";
  }, [buildings.data]);
  const currentBlock = blocks.data?.find((item) => item.id === block);

  const buildingColumns = useMemo<ColumnDef<AdminBuilding>[]>(
    () => [
      {
        id: "name",
        meta: { label: t("structure.name"), primary: true },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            {row.original.name.az}
            {demoBadge(row.original.isDemo)}
          </span>
        ),
      },
      {
        id: "blocks",
        meta: { label: t("structure.blocksCount"), align: "end" },
        cell: ({ row }) => row.original.blocks,
      },
      {
        id: "actions",
        meta: { label: t("apartments.actions"), align: "end" },
        cell: ({ row }) => (
          <RowActions
            name={row.original.name.az}
            abilities={abilities}
            onEdit={() => setEditing({ kind: "building", item: row.original })}
            onDelete={() =>
              void remove(row.original.name.az, () => deleteBuilding(row.original.id).unwrap())
            }
          />
        ),
      },
    ],
    [abilities, remove, deleteBuilding],
  );

  const blockColumns = useMemo<ColumnDef<AdminBlock>[]>(
    () => [
      {
        id: "code",
        meta: { label: t("structure.blockCode"), primary: true },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            {row.original.code}
            {demoBadge(row.original.isDemo)}
          </span>
        ),
      },
      {
        id: "name",
        meta: { label: t("structure.name") },
        cell: ({ row }) => row.original.name.az,
      },
      {
        id: "building",
        meta: { label: t("structure.building") },
        cell: ({ row }) => buildingName(row.original.buildingId),
      },
      {
        id: "floors",
        meta: { label: t("structure.floorsCount"), align: "end" },
        cell: ({ row }) => row.original.floors,
      },
      {
        id: "apartments",
        meta: { label: t("structure.apartmentsCount"), align: "end" },
        cell: ({ row }) => row.original.apartments,
      },
      {
        id: "actions",
        meta: { label: t("apartments.actions"), align: "end" },
        cell: ({ row }) => {
          const name = t("structure.blockName", { code: row.original.code });
          return (
            <RowActions
              name={name}
              abilities={abilities}
              onEdit={() => setEditing({ kind: "block", item: row.original })}
              onDelete={() => void remove(name, () => deleteBlock(row.original.id).unwrap())}
            />
          );
        },
      },
    ],
    [abilities, remove, deleteBlock, buildingName],
  );

  const floorColumns = useMemo<ColumnDef<AdminFloor>[]>(
    () => [
      {
        id: "number",
        meta: { label: t("structure.floorNumber"), primary: true },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            {t("apartments.floorValue", { floor: row.original.number })}
            {demoBadge(row.original.isDemo)}
          </span>
        ),
      },
      {
        id: "plan",
        meta: { label: t("structure.floorPlan") },
        cell: ({ row }) =>
          row.original.plan ? (
            (row.original.plan.alt ?? t("picker.untitled"))
          ) : (
            <span className="text-muted-foreground">{t("layouts.noPlan")}</span>
          ),
      },
      {
        id: "apartments",
        meta: { label: t("structure.apartmentsCount"), align: "end" },
        cell: ({ row }) => row.original.apartments,
      },
      {
        id: "actions",
        meta: { label: t("apartments.actions"), align: "end" },
        cell: ({ row }) => {
          const name = t("structure.floorName", {
            block: row.original.blockCode,
            floor: row.original.number,
          });
          return (
            <RowActions
              name={name}
              abilities={abilities}
              onEdit={() => setEditing({ kind: "floor", item: row.original })}
              onDelete={() => void remove(name, () => deleteFloor(row.original.id).unwrap())}
            />
          );
        },
      },
    ],
    [abilities, remove, deleteFloor],
  );

  const addButton = (label: string, onClick: () => void, disabled = false) =>
    abilities.create ? (
      <Button type="button" variant="outline" onClick={onClick} disabled={disabled}>
        <Plus aria-hidden />
        {label}
      </Button>
    ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <Section
        title={t("structure.buildings")}
        action={addButton(t("structure.newBuilding"), () => setEditing({ kind: "building" }))}
      >
        <DataTable<AdminBuilding, void>
          caption={t("structure.buildings")}
          columns={buildingColumns}
          defaultSort="name"
          useList={useBuildingList}
          toParams={() => undefined}
          getRowId={(item) => item.id}
        />
      </Section>

      <Section
        title={t("structure.blocks")}
        action={addButton(
          t("structure.newBlock"),
          () => setEditing({ kind: "block" }),
          !buildings.data?.length,
        )}
      >
        <DataTable<AdminBlock, void>
          caption={t("structure.blocks")}
          columns={blockColumns}
          defaultSort="code"
          useList={useBlockList}
          toParams={() => undefined}
          getRowId={(item) => item.id}
        />
      </Section>

      <Section
        title={t("structure.floors")}
        action={addButton(
          t("structure.newFloor"),
          () => setEditing({ kind: "floor" }),
          !currentBlock,
        )}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={blockSelectId}>{t("structure.block")}</Label>
          <Select value={block} onValueChange={setBlock}>
            <SelectTrigger id={blockSelectId} className="w-full sm:w-64">
              <SelectValue placeholder={t("apartments.field.choose")} />
            </SelectTrigger>
            <SelectContent>
              {(blocks.data ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {t("structure.blockName", { code: item.code })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {block ? (
          <DataTable<AdminFloor, { block: string }>
            caption={t("structure.floors")}
            columns={floorColumns}
            defaultSort="number"
            useList={useFloorList}
            toParams={() => ({ block })}
            getRowId={(item) => item.id}
          />
        ) : null}
      </Section>

      <EditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={
          editing?.kind === "building"
            ? editing.item
              ? t("structure.editBuilding")
              : t("structure.newBuilding")
            : editing?.kind === "block"
              ? editing.item
                ? t("structure.editBlock")
                : t("structure.newBlock")
              : editing?.item
                ? t("structure.editFloor")
                : t("structure.newFloor")
        }
      >
        {editing?.kind === "building" ? (
          <BuildingForm item={editing.item} onDone={() => setEditing(null)} />
        ) : editing?.kind === "block" ? (
          <BlockForm
            item={editing.item}
            buildings={buildings.data ?? []}
            onDone={() => setEditing(null)}
          />
        ) : editing?.kind === "floor" && (editing.item || currentBlock) ? (
          <FloorForm
            item={editing.item}
            blockId={editing.item?.blockId ?? currentBlock!.id}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </EditDialog>
    </div>
  );
}

function EditDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** The dialog form's buttons and its form-level message. */
function DialogForm<TIn extends FieldValues, TOut extends FieldValues>({
  form,
  onSubmit,
  busy,
  isNew,
  alert,
  onCancel,
  children,
}: {
  form: UseFormReturn<TIn, unknown, TOut>;
  onSubmit: () => void;
  busy: boolean;
  isNew: boolean;
  alert: string | null;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="flex min-w-0 flex-col gap-5"
      >
        <FormAlert message={alert} />
        {children}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("ui.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {isNew ? t("structure.create") : t("structure.save")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

const translatable = (value?: { az: string; en?: string | null; ru?: string | null }) => ({
  az: value?.az ?? "",
  en: value?.en ?? "",
  ru: value?.ru ?? "",
});

function BuildingForm({ item, onDone }: { item?: AdminBuilding; onDone: () => void }) {
  const [create, created] = useCreateBuildingMutation();
  const [update, updated] = useUpdateBuildingMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(buildingCreateSchema, {
    defaultValues: { name: translatable(item?.name), sortOrder: String(item?.sortOrder ?? 0) },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      if (item) await update({ id: item.id, ...values }).unwrap();
      else await create(values).unwrap();
      toast.success(t("structure.saved"));
      onDone();
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
  });
  return (
    <DialogForm
      form={form}
      onSubmit={() => void onSubmit()}
      busy={created.isLoading || updated.isLoading}
      isNew={!item}
      alert={alert}
      onCancel={onDone}
    >
      <TranslatableField<BuildingCreate> name="name" label={t("structure.name")} />
      <TextField<BuildingCreate>
        name="sortOrder"
        label={t("layouts.sortOrder")}
        description={t("layouts.sortOrderHint")}
        inputMode="numeric"
        autoComplete="off"
      />
    </DialogForm>
  );
}

function BlockForm({
  item,
  buildings,
  onDone,
}: {
  item?: AdminBlock;
  buildings: AdminBuilding[];
  onDone: () => void;
}) {
  const [create, created] = useCreateBlockMutation();
  const [update, updated] = useUpdateBlockMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(blockCreateSchema, {
    defaultValues: {
      buildingId: item?.buildingId ?? buildings[0]?.id ?? "",
      code: item?.code ?? "",
      name: translatable(item?.name),
      sortOrder: String(item?.sortOrder ?? 0),
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      if (item) await update({ id: item.id, ...values }).unwrap();
      else await create(values).unwrap();
      toast.success(t("structure.saved"));
      onDone();
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
  });
  return (
    <DialogForm
      form={form}
      onSubmit={() => void onSubmit()}
      busy={created.isLoading || updated.isLoading}
      isNew={!item}
      alert={alert}
      onCancel={onDone}
    >
      <SelectField<BlockCreate>
        name="buildingId"
        label={t("structure.building")}
        options={buildings.map((building) => ({ value: building.id, label: building.name.az }))}
      />
      <TextField<BlockCreate>
        name="code"
        label={t("structure.blockCode")}
        description={t("structure.blockCodeHint")}
        autoComplete="off"
      />
      <TranslatableField<BlockCreate> name="name" label={t("structure.name")} />
      <TextField<BlockCreate>
        name="sortOrder"
        label={t("layouts.sortOrder")}
        description={t("layouts.sortOrderHint")}
        inputMode="numeric"
        autoComplete="off"
      />
    </DialogForm>
  );
}

function FloorForm({
  item,
  blockId,
  onDone,
}: {
  item?: AdminFloor;
  blockId: string;
  onDone: () => void;
}) {
  const [create, created] = useCreateFloorMutation();
  const [update, updated] = useUpdateFloorMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const [plan, setPlan] = useState<AdminPlan | null>(item?.plan ?? null);
  const form = useAdminForm(floorCreateSchema, {
    defaultValues: {
      blockId,
      number: item ? String(item.number) : "",
      planMediaId: item?.plan?.id ?? null,
    },
  });
  const onSubmit = form.handleSubmit(async ({ blockId: block, ...values }) => {
    setAlert(null);
    try {
      if (item) await update({ id: item.id, ...values }).unwrap();
      else await create({ blockId: block, ...values }).unwrap();
      toast.success(t("structure.saved"));
      onDone();
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
  });
  return (
    <DialogForm
      form={form}
      onSubmit={() => void onSubmit()}
      busy={created.isLoading || updated.isLoading}
      isNew={!item}
      alert={alert}
      onCancel={onDone}
    >
      <TextField<FloorCreate>
        name="number"
        label={t("structure.floorNumber")}
        description={t("structure.floorNumberHint")}
        inputMode="numeric"
        autoComplete="off"
      />
      <MediaPicker
        label={t("structure.floorPlan")}
        value={plan}
        onChange={(next) => {
          setPlan(next);
          form.setValue("planMediaId", next?.id ?? null, { shouldDirty: true });
        }}
      />
    </DialogForm>
  );
}
