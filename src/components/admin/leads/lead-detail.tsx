"use client";

import { ExternalLink, MessageCircle, Phone } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { z } from "zod";

import { TextareaField } from "@/components/admin/form/fields";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { useUnsavedChangesGuard } from "@/components/admin/feedback/unsaved-changes";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { formatPhone } from "@/i18n/format";
import { adminDateTime } from "@/lib/admin/format";
import { leadTelHref, leadWhatsappHref } from "@/lib/admin/lead-links";
import { t } from "@/lib/admin/messages";
import { cn } from "@/lib/admin/utils";
import {
  leadNoteSchema,
  leadStatuses,
  leadTextMax,
  utmKeys,
  type AdminLeadDetail,
  type LeadStatus,
  type LeadUser,
} from "@/shared/leads";
import {
  useAddLeadNoteMutation,
  useAdminLeadQuery,
  useUpdateLeadMutation,
} from "@/store/endpoints/admin-leads";

import { LeadStatusBadge } from "./lead-status";
import { LeadTimeline } from "./lead-timeline";

export type LeadViewer = {
  id: string;
  /** `leads:assign`: may give the lead to anyone. */
  canAssign: boolean;
};

/**
 * One lead (#26), built for a phone held in one hand: call and WhatsApp in a
 * bar at the bottom of the screen, then the contact, the pipeline and the
 * assignee, a note, and the timeline, newest first. From `md` the call
 * buttons sit in the contact card.
 */
export function LeadDetail({
  initial,
  viewer,
  assignees,
}: {
  initial: AdminLeadDetail;
  viewer: LeadViewer;
  assignees: LeadUser[];
}) {
  const { data = initial } = useAdminLeadQuery(initial.id, { refetchOnFocus: true });
  const lead = data;

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-0">
      <PageHeader
        title={lead.name}
        description={t("leads.detailLead", {
          type: t(`leadType.${lead.type}`),
          date: adminDateTime(lead.createdAt),
        })}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ContactCard lead={lead} />
        <PipelineCard lead={lead} viewer={viewer} assignees={assignees} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <NoteCard id={lead.id} />
          <Section title={t("leads.timeline")}>
            <LeadTimeline entries={lead.timeline} />
          </Section>
        </div>
        <SourceCard lead={lead} />
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 gap-4 shadow-none", className)}>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function Fields({ rows }: { rows: Array<[label: string, value: ReactNode] | null> }) {
  return (
    <dl className="text-sm grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2">
      {rows
        .filter((row) => row !== null)
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

const linkClass =
  "inline-flex min-h-(--spacing-target) items-center gap-1 underline underline-offset-4 md:min-h-0";

function ContactCard({ lead }: { lead: AdminLeadDetail }) {
  return (
    <Section title={t("leads.contact")}>
      {lead.anonymisedAt ? (
        <p className="text-sm">
          {t("leads.anonymisedLead", { date: adminDateTime(lead.anonymisedAt) })}
        </p>
      ) : null}
      <Fields
        rows={[
          [
            t("leads.phone"),
            lead.phone ? (
              <a href={leadTelHref(lead.phone)} className={linkClass}>
                {formatPhone(lead.phone)}
              </a>
            ) : (
              <span className="text-muted-foreground">{t("leads.anonymised")}</span>
            ),
          ],
          lead.email
            ? [
                t("leads.email"),
                <a key="email" href={`mailto:${lead.email}`} className={linkClass}>
                  {lead.email}
                </a>,
              ]
            : null,
          lead.preferredAt ? [t("leads.preferredAt"), adminDateTime(lead.preferredAt)] : null,
          lead.apartment
            ? [
                t("leads.apartment"),
                <a
                  key="apartment"
                  href={`/menziller/${lead.apartment.slug}`}
                  target="_blank"
                  rel="noopener"
                  className={linkClass}
                >
                  {lead.apartment.label}
                  <ExternalLink aria-hidden className="size-3.5" />
                  <span className="sr-only">{t("ui.newTab")}</span>
                </a>,
              ]
            : null,
          lead.message
            ? [
                t("leads.message"),
                <p key="message" className="whitespace-pre-wrap">
                  {lead.message}
                </p>,
              ]
            : null,
        ]}
      />
      {lead.phone ? <CallBar lead={lead} /> : null}
    </Section>
  );
}

/**
 * Call and WhatsApp: a bar fixed to the bottom of the screen below `md`,
 * where the thumb reaches, and two buttons in the card above it.
 */
function CallBar({ lead }: { lead: AdminLeadDetail }) {
  return (
    <div
      data-testid="lead-call-bar"
      className="bg-background fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 gap-2 border-t p-3 md:static md:z-auto md:border-0 md:bg-transparent md:p-0"
    >
      <Button asChild size="lg" className="h-12">
        <a href={leadTelHref(lead.phone)}>
          <Phone aria-hidden />
          {t("leads.call")}
        </a>
      </Button>
      <Button asChild size="lg" variant="outline" className="h-12">
        <a href={leadWhatsappHref(lead.phone, lead.name)} target="_blank" rel="noopener">
          <MessageCircle aria-hidden />
          {t("leads.whatsapp")}
          <span className="sr-only">{t("ui.newTab")}</span>
        </a>
      </Button>
    </div>
  );
}

const unassigned = "none";

function PipelineCard({
  lead,
  viewer,
  assignees,
}: {
  lead: AdminLeadDetail;
  viewer: LeadViewer;
  assignees: LeadUser[];
}) {
  const [update, { isLoading }] = useUpdateLeadMutation();
  const [lostOpen, setLostOpen] = useState(false);
  const statusTrigger = useRef<HTMLButtonElement>(null);

  async function change(body: Parameters<typeof update>[0], done: string) {
    try {
      await update(body).unwrap();
      toast.success(done);
      return true;
    } catch (error) {
      toastApiError(error);
      return false;
    }
  }

  const onStatus = (value: string) => {
    const status = value as LeadStatus;
    if (status === lead.status) return;
    if (status === "lost") setLostOpen(true);
    else
      void change(
        { id: lead.id, status },
        t("leads.statusChanged", { status: t(`leadStatus.${status}`) }),
      );
  };

  // The current assignee stays in the list even when they can no longer be chosen.
  const options =
    lead.assignee && !assignees.some((user) => user.id === lead.assignee?.id)
      ? [lead.assignee, ...assignees]
      : assignees;

  return (
    <Section title={t("leads.pipeline")}>
      <div className="grid gap-2">
        <Label htmlFor="lead-status">{t("leads.status")}</Label>
        <Select value={lead.status} onValueChange={onStatus}>
          <SelectTrigger id="lead-status" ref={statusTrigger} className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {leadStatuses.map((status, index) => (
              <SelectItem key={status} value={status}>
                {index + 1}. {t(`leadStatus.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{t("leads.pipelineHint")}</p>
        {lead.status === "lost" && lead.lostReason ? (
          <p className="text-sm">
            <span className="text-muted-foreground">{t("leads.lostReason")}: </span>
            {lead.lostReason}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        {viewer.canAssign ? (
          <>
            <Label htmlFor="lead-assignee">{t("leads.assignee")}</Label>
            <Select
              value={lead.assignee?.id ?? unassigned}
              onValueChange={(value) => {
                const assigneeId = value === unassigned ? null : value;
                const name = options.find((user) => user.id === assigneeId)?.name;
                void change(
                  { id: lead.id, assigneeId },
                  name ? t("leads.assignedTo", { name }) : t("leads.unassignedDone"),
                );
              }}
            >
              <SelectTrigger id="lead-assignee" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={unassigned}>{t("leads.unassigned")}</SelectItem>
                {options.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.id === viewer.id
                      ? t("leads.assignee.self", { name: user.name })
                      : user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">{t("leads.assignee")}</p>
            {lead.assignee ? (
              <p className="text-sm">
                {lead.assignee.id === viewer.id
                  ? t("leads.assignee.self", { name: lead.assignee.name })
                  : lead.assignee.name}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">{t("leads.unassigned")}</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() =>
                    void change({ id: lead.id, assigneeId: viewer.id }, t("leads.taken"))
                  }
                >
                  {t("leads.take")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <LostReasonDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        onCloseAutoFocus={() => statusTrigger.current?.focus()}
        onSubmit={(lostReason) =>
          change(
            { id: lead.id, status: "lost", lostReason },
            t("leads.statusChanged", { status: t("leadStatus.lost") }),
          )
        }
      />
    </Section>
  );
}

const lostReasonSchema = z.object({
  lostReason: z.string().trim().min(1).max(leadTextMax.lostReason),
});

/** `lost` needs a reason; the dialog asks for it before the status changes. */
function LostReasonDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
  onSubmit: (reason: string) => Promise<boolean>;
}) {
  const form = useAdminForm(lostReasonSchema, { defaultValues: { lostReason: "" } });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <Form {...form}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(async ({ lostReason }) => {
              if (await onSubmit(lostReason)) {
                form.reset();
                onOpenChange(false);
              }
            })}
          >
            <DialogHeader>
              <DialogTitle>{t("leads.lostTitle")}</DialogTitle>
              <DialogDescription>{t("leads.lostLead")}</DialogDescription>
            </DialogHeader>
            <TextareaField<z.input<typeof lostReasonSchema>>
              name="lostReason"
              label={t("leads.lostReason")}
              maxLength={leadTextMax.lostReason}
              rows={3}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("ui.cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t("leads.markLost")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function NoteCard({ id }: { id: string }) {
  const [addNote] = useAddLeadNoteMutation();
  const form = useAdminForm(leadNoteSchema, { defaultValues: { body: "" } });
  useUnsavedChangesGuard(form.formState.isDirty);

  return (
    <Section title={t("leads.addNote")}>
      <Form {...form}>
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit(async ({ body }) => {
            try {
              await addNote({ id, body }).unwrap();
              form.reset({ body: "" });
              toast.success(t("leads.noteAdded"));
            } catch (error) {
              toast.error(applyApiErrors(form, error));
            }
          })}
        >
          <TextareaField<z.input<typeof leadNoteSchema>>
            name="body"
            label={t("leads.note")}
            description={t("leads.noteHint")}
            maxLength={leadTextMax.note}
            rows={3}
          />
          <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
            {t("leads.saveNote")}
          </Button>
        </form>
      </Form>
    </Section>
  );
}

function SourceCard({ lead }: { lead: AdminLeadDetail }) {
  const utm = utmKeys.flatMap((key) => {
    const value = lead.utm?.[key];
    return value ? [[`utm_${key}`, value] as [string, string]] : [];
  });
  return (
    <Section title={t("leads.attribution")} className="lg:self-start">
      <Fields
        rows={[
          [t("leads.source"), lead.source],
          [
            t("leads.sourcePath"),
            // Visitors send the path; only a path on this site becomes a link.
            /^\/(?![/\\])/.test(lead.sourcePath) ? (
              <a
                key="source"
                href={lead.sourcePath}
                target="_blank"
                rel="noopener"
                className={`${linkClass} break-all`}
              >
                {lead.sourcePath}
                <span className="sr-only">{t("ui.newTab")}</span>
              </a>
            ) : (
              <span key="source" className="break-all">
                {lead.sourcePath}
              </span>
            ),
          ],
          ...utm,
          lead.referrer
            ? [
                t("leads.referrer"),
                <span key="referrer" className="break-all">
                  {lead.referrer}
                </span>,
              ]
            : null,
          [t("leads.locale"), t(`locale.${lead.locale}`)],
          [t("leads.status"), <LeadStatusBadge key="status" status={lead.status} />],
        ]}
      />
    </Section>
  );
}
