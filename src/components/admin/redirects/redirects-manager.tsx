"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable, type ListResult } from "@/components/admin/data-table/data-table";
import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { SelectField, TextField } from "@/components/admin/form/fields";
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
import { adminDateTime, adminNumber } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import {
  redirectCreateSchema,
  type AdminRedirect,
  type RedirectChainDetails,
  type RedirectCreate,
  type RedirectLoopDetails,
} from "@/shared/redirects";
import {
  useAdminRedirectsQuery,
  useCreateRedirectMutation,
  useDeleteRedirectMutation,
  useUpdateRedirectMutation,
} from "@/store/endpoints/admin-redirects";
import { apiErrorOf } from "@/store/errors";

const statusOptions = [
  { value: "301", label: t("redirects.status301") },
  { value: "302", label: t("redirects.status302") },
];

const arrow = " → ";

/** The redirects are few and unpaginated; the table shows them as one page. */
function useRedirectList(): ListResult<AdminRedirect> {
  const result = useAdminRedirectsQuery();
  const items = result.data;
  return {
    ...result,
    data: items && {
      items,
      page: 1,
      pageSize: Math.max(items.length, 1),
      total: items.length,
      pageCount: 1,
    },
  };
}

type Editing = { item?: AdminRedirect } | null;

/**
 * The console's redirects (#27): source, destination, 301 or 302 and how
 * often each was followed. Saving refuses a loop and offers to resolve a
 * chain by pointing every redirect of it straight at the final destination.
 */
export function RedirectsManager({ canEdit }: { canEdit: boolean }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Editing>(null);
  const [remove] = useDeleteRedirectMutation();

  const columns = useMemo<ColumnDef<AdminRedirect>[]>(() => {
    const onDelete = async (item: AdminRedirect) => {
      const confirmed = await confirm({
        title: t("redirects.deleteTitle", { path: item.fromPath }),
        description: t("redirects.deleteLead"),
        confirmLabel: t("redirects.delete"),
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await remove(item.id).unwrap();
        toast.success(t("redirects.deleted"));
      } catch (error) {
        toastApiError(error);
      }
    };

    const base: ColumnDef<AdminRedirect>[] = [
      {
        id: "from",
        meta: { label: t("redirects.from"), primary: true },
        cell: ({ row }) => <span className="break-all">{row.original.fromPath}</span>,
      },
      {
        id: "to",
        meta: { label: t("redirects.to") },
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-1">
            <span className="break-all">{row.original.toPath}</span>
            {row.original.chained ? (
              <Badge variant="outline">
                <Link2 aria-hidden />
                {t("redirects.chained")}
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        id: "status",
        meta: { label: t("redirects.status") },
        cell: ({ row }) =>
          t(row.original.statusCode === 301 ? "redirects.status301" : "redirects.status302"),
      },
      {
        id: "hits",
        meta: { label: t("redirects.hits"), align: "end" },
        cell: ({ row }) => adminNumber(row.original.hits, 0),
      },
      {
        id: "lastHit",
        meta: { label: t("redirects.lastHit") },
        cell: ({ row }) =>
          row.original.lastHitAt ? (
            adminDateTime(row.original.lastHitAt)
          ) : (
            <span className="text-muted-foreground">{t("redirects.never")}</span>
          ),
      },
    ];
    if (!canEdit) return base;
    return [
      ...base,
      {
        id: "actions",
        meta: { label: t("redirects.actions"), align: "end" },
        cell: ({ row }) => (
          <span className="inline-flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("redirects.editLabel", { path: row.original.fromPath })}
              onClick={() => setEditing({ item: row.original })}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("redirects.deleteLabel", { path: row.original.fromPath })}
              onClick={() => void onDelete(row.original)}
            >
              <Trash2 aria-hidden />
            </Button>
          </span>
        ),
      },
    ];
  }, [canEdit, confirm, remove]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {canEdit ? (
        <div>
          <Button type="button" onClick={() => setEditing({})}>
            <Plus aria-hidden />
            {t("redirects.new")}
          </Button>
        </div>
      ) : null}
      <DataTable<AdminRedirect, void>
        caption={t("redirects.caption")}
        columns={columns}
        defaultSort="from"
        useList={useRedirectList}
        toParams={() => undefined}
        getRowId={(item) => item.id}
      />
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{editing?.item ? t("redirects.edit") : t("redirects.new")}</DialogTitle>
          </DialogHeader>
          {editing ? <RedirectForm item={editing.item} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RedirectForm({ item, onDone }: { item?: AdminRedirect; onDone: () => void }) {
  const confirm = useConfirm();
  const [create, created] = useCreateRedirectMutation();
  const [update, updated] = useUpdateRedirectMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(redirectCreateSchema, {
    defaultValues: {
      fromPath: item?.fromPath ?? "",
      toPath: item?.toPath ?? "",
      statusCode: item ? (String(item.statusCode) as "301" | "302") : "301",
    },
  });
  const busy = created.isLoading || updated.isLoading;

  const send = (body: RedirectCreate) =>
    item ? update({ id: item.id, ...body }).unwrap() : create(body).unwrap();

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      await send(values);
    } catch (error) {
      const body = apiErrorOf(error);
      if (body?.code === "REDIRECT_LOOP") {
        const { cycle } = body as unknown as RedirectLoopDetails;
        applyApiErrors(form, error);
        setAlert(t("redirects.loop", { cycle: cycle.join(arrow) }));
        return;
      }
      if (body?.code !== "REDIRECT_CHAIN") {
        setAlert(applyApiErrors(form, error));
        return;
      }
      const chain = body as unknown as RedirectChainDetails;
      const lead = t("redirects.chainLead", { hops: chain.hops.join(arrow), final: chain.final });
      const incoming = chain.incoming.length
        ? ` ${t("redirects.chainIncoming", { paths: chain.incoming.join(", ") })}`
        : "";
      const resolve = await confirm({
        title: t("redirects.chainTitle"),
        description: `${lead}${incoming}`,
        confirmLabel: t("redirects.chainResolve"),
      });
      if (!resolve) return;
      try {
        await send({ ...values, resolveChains: true });
      } catch (retryError) {
        setAlert(applyApiErrors(form, retryError));
        return;
      }
    }
    toast.success(item ? t("redirects.saved") : t("redirects.created"));
    onDone();
  });

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
        className="flex min-w-0 flex-col gap-5"
      >
        <FormAlert message={alert} />
        <TextField<RedirectCreate>
          name="fromPath"
          label={t("redirects.from")}
          description={t("redirects.fromHint")}
          autoComplete="off"
          spellCheck={false}
        />
        <TextField<RedirectCreate>
          name="toPath"
          label={t("redirects.to")}
          description={t("redirects.toHint")}
          autoComplete="off"
          spellCheck={false}
        />
        <SelectField<RedirectCreate>
          name="statusCode"
          label={t("redirects.status")}
          description={t("redirects.statusHint")}
          options={statusOptions}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {t("ui.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {item ? t("redirects.save") : t("redirects.create")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
