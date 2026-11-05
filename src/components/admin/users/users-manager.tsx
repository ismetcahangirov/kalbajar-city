"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MailPlus, Send, UserCheck, UserCog, UserX, X } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Form } from "@/components/admin/ui/form";
import { adminDateTime } from "@/lib/admin/format";
import { roleLabel, t } from "@/lib/admin/messages";
import {
  invitationCreateSchema,
  invitationLifetimeDays,
  roleValues,
  setRoleSchema,
  type AdminInvitation,
  type AdminUser,
  type InvitationCreate,
  type InvitationSent,
  type SetRole,
} from "@/shared/users";
import {
  useAdminInvitationsQuery,
  useAdminUsersQuery,
  useCreateInvitationMutation,
  useDeactivateUserMutation,
  useReactivateUserMutation,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
  useSetUserRoleMutation,
} from "@/store/endpoints/admin-users";

/** Accounts and invitations are few and unpaginated; a table shows them as one page. */
function asOnePage<T>(result: Omit<ListResult<T>, "data"> & { data?: T[] }): ListResult<T> {
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

const useUserList = (): ListResult<AdminUser> => asOnePage(useAdminUsersQuery());
const useInvitationList = (): ListResult<AdminInvitation> => asOnePage(useAdminInvitationsQuery());

/** Only an owner may hand out the owner role; the server refuses it from anyone else. */
function roleOptions(canGrantOwner: boolean) {
  return roleValues
    .filter((role) => canGrantOwner || role !== "owner")
    .map((role) => ({ value: role, label: roleLabel(role) }));
}

function announceMail({ mailSent }: InvitationSent, success: string) {
  if (mailSent) toast.success(success);
  else toast.warning(t("invite.mailFailed"));
}

/**
 * The console's users (#27): who has an account and with which role, who has
 * been invited, and the actions the signed-in user may take on each. The server
 * decides, per row, what is manageable, and refuses the rest anyway.
 */
export function UsersManager({ canGrantOwner }: { canGrantOwner: boolean }) {
  const [inviting, setInviting] = useState(false);
  const [changing, setChanging] = useState<AdminUser | null>(null);
  const confirm = useConfirm();
  const [deactivate] = useDeactivateUserMutation();
  const [reactivate] = useReactivateUserMutation();

  const columns = useMemo<ColumnDef<AdminUser>[]>(() => {
    const onDeactivate = async (item: AdminUser) => {
      const confirmed = await confirm({
        title: t("users.deactivateTitle", { name: item.name }),
        description: t("users.deactivateLead"),
        confirmLabel: t("users.deactivate"),
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await deactivate(item.id).unwrap();
        toast.success(t("users.deactivated"));
      } catch (error) {
        toastApiError(error);
      }
    };
    const onReactivate = async (item: AdminUser) => {
      try {
        await reactivate(item.id).unwrap();
        toast.success(t("users.reactivated"));
      } catch (error) {
        toastApiError(error);
      }
    };

    return [
      {
        id: "name",
        meta: { label: t("users.name"), primary: true },
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="break-words">{row.original.name}</span>
            {row.original.self ? <Badge variant="outline">{t("users.you")}</Badge> : null}
          </span>
        ),
      },
      {
        id: "email",
        meta: { label: t("users.email") },
        cell: ({ row }) => <span className="break-all">{row.original.email}</span>,
      },
      {
        id: "role",
        meta: { label: t("users.role") },
        cell: ({ row }) => roleLabel(row.original.role),
      },
      {
        id: "status",
        meta: { label: t("users.status") },
        cell: ({ row }) =>
          row.original.active ? (
            <Badge variant="outline">{t("users.active")}</Badge>
          ) : (
            <Badge variant="secondary">{t("users.inactive")}</Badge>
          ),
      },
      {
        id: "lastSignIn",
        meta: { label: t("users.lastSignIn") },
        cell: ({ row }) =>
          row.original.lastSignInAt ? (
            adminDateTime(row.original.lastSignInAt)
          ) : (
            <span className="text-muted-foreground">{t("users.never")}</span>
          ),
      },
      {
        id: "actions",
        meta: { label: t("users.actions"), align: "end" },
        cell: ({ row }) => {
          const item = row.original;
          if (!item.manageable) return null;
          return (
            <span className="inline-flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("users.changeRoleLabel", { name: item.name })}
                onClick={() => setChanging(item)}
              >
                <UserCog aria-hidden />
              </Button>
              {item.active ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("users.deactivateLabel", { name: item.name })}
                  onClick={() => void onDeactivate(item)}
                >
                  <UserX aria-hidden />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("users.reactivateLabel", { name: item.name })}
                  onClick={() => void onReactivate(item)}
                >
                  <UserCheck aria-hidden />
                </Button>
              )}
            </span>
          );
        },
      },
    ];
  }, [confirm, deactivate, reactivate]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Button type="button" onClick={() => setInviting(true)}>
          <MailPlus aria-hidden />
          {t("invite.new")}
        </Button>
      </div>
      <DataTable<AdminUser, void>
        caption={t("users.caption")}
        columns={columns}
        defaultSort="name"
        useList={useUserList}
        toParams={() => undefined}
        getRowId={(item) => item.id}
      />
      <PendingInvitations />

      <Dialog open={inviting} onOpenChange={setInviting}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("invite.title")}</DialogTitle>
            <DialogDescription>
              {t("invite.hint", { days: invitationLifetimeDays })}
            </DialogDescription>
          </DialogHeader>
          {inviting ? (
            <InviteForm canGrantOwner={canGrantOwner} onDone={() => setInviting(false)} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={changing !== null} onOpenChange={(open) => !open && setChanging(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("users.changeRoleTitle", { name: changing?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("users.roleHint")}</DialogDescription>
          </DialogHeader>
          {changing ? (
            <RoleForm
              item={changing}
              canGrantOwner={canGrantOwner}
              onDone={() => setChanging(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendingInvitations() {
  const confirm = useConfirm();
  const { data } = useAdminInvitationsQuery();
  const [resend] = useResendInvitationMutation();
  const [revoke] = useRevokeInvitationMutation();

  const columns = useMemo<ColumnDef<AdminInvitation>[]>(() => {
    const onResend = async (item: AdminInvitation) => {
      try {
        announceMail(await resend(item.id).unwrap(), t("invite.resent", { email: item.email }));
      } catch (error) {
        toastApiError(error);
      }
    };
    const onRevoke = async (item: AdminInvitation) => {
      const confirmed = await confirm({
        title: t("invite.revokeTitle", { email: item.email }),
        description: t("invite.revokeLead"),
        confirmLabel: t("invite.revoke"),
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await revoke(item.id).unwrap();
        toast.success(t("invite.revoked"));
      } catch (error) {
        toastApiError(error);
      }
    };

    return [
      {
        id: "email",
        meta: { label: t("users.email"), primary: true },
        cell: ({ row }) => <span className="break-all">{row.original.email}</span>,
      },
      {
        id: "role",
        meta: { label: t("users.role") },
        cell: ({ row }) => roleLabel(row.original.role),
      },
      {
        id: "invitedBy",
        meta: { label: t("invite.invitedBy") },
        cell: ({ row }) => row.original.invitedByName ?? "",
      },
      {
        id: "expires",
        meta: { label: t("invite.expires") },
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            {adminDateTime(row.original.expiresAt)}
            <Badge variant={row.original.expired ? "secondary" : "outline"}>
              {t(row.original.expired ? "invite.expired" : "invite.pending")}
            </Badge>
          </span>
        ),
      },
      {
        id: "actions",
        meta: { label: t("users.actions"), align: "end" },
        cell: ({ row }) => {
          const item = row.original;
          if (!item.manageable) return null;
          return (
            <span className="inline-flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("invite.resendLabel", { email: item.email })}
                onClick={() => void onResend(item)}
              >
                <Send aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("invite.revokeLabel", { email: item.email })}
                onClick={() => void onRevoke(item)}
              >
                <X aria-hidden />
              </Button>
            </span>
          );
        },
      },
    ];
  }, [confirm, resend, revoke]);

  if (!data?.length) return null;
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="pending-invitations">
      <h2 id="pending-invitations" className="text-base font-semibold">
        {t("invite.heading")}
      </h2>
      <DataTable<AdminInvitation, void>
        caption={t("invite.caption")}
        columns={columns}
        defaultSort="email"
        useList={useInvitationList}
        toParams={() => undefined}
        getRowId={(item) => item.id}
      />
    </section>
  );
}

function InviteForm({ canGrantOwner, onDone }: { canGrantOwner: boolean; onDone: () => void }) {
  const [create, { isLoading }] = useCreateInvitationMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(invitationCreateSchema, {
    defaultValues: { email: "", role: "editor" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      const sent = await create(values).unwrap();
      announceMail(sent, t("invite.sent", { email: values.email }));
      onDone();
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
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
        <TextField<InvitationCreate>
          name="email"
          label={t("users.email")}
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
        />
        <SelectField<InvitationCreate>
          name="role"
          label={t("users.role")}
          options={roleOptions(canGrantOwner)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {t("ui.cancel")}
          </Button>
          <Button type="submit" disabled={isLoading}>
            {t("invite.send")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function RoleForm({
  item,
  canGrantOwner,
  onDone,
}: {
  item: AdminUser;
  canGrantOwner: boolean;
  onDone: () => void;
}) {
  const [save, { isLoading }] = useSetUserRoleMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(setRoleSchema, { defaultValues: { role: item.role } });

  const onSubmit = form.handleSubmit(async ({ role }) => {
    setAlert(null);
    try {
      await save({ id: item.id, role }).unwrap();
      toast.success(t("users.roleSaved"));
      onDone();
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
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
        <SelectField<SetRole>
          name="role"
          label={t("users.role")}
          options={roleOptions(canGrantOwner)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {t("ui.cancel")}
          </Button>
          <Button type="submit" disabled={isLoading}>
            {t("users.roleSave")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
