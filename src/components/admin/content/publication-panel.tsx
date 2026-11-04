"use client";

import { CalendarClock, Send, Undo2 } from "lucide-react";
import { useId, useState } from "react";

import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast } from "@/components/admin/feedback/toast";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { adminDateTime, bakuInputToIso, bakuInputValue } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import type { ContentState } from "@/shared/content";

import { ContentStateBadge } from "./content-state-badge";

export type PublicationRequest = { publish: boolean; publishedAt?: string };

/**
 * Where an entry stands and what can be done about it (#25): publish now,
 * schedule for a moment in Baku time, withdraw, or cancel a schedule. The
 * scheduled-publication trigger publishes a scheduled entry when its time
 * comes. Unsaved edits are saved first, so what is published is what the
 * editor sees.
 */
export function PublicationPanel({
  entry,
  canPublish,
  dirty,
  busy,
  onChange,
}: {
  entry: { state: ContentState; publishedAt: string | null; scheduledAt: string | null };
  canPublish: boolean;
  dirty: boolean;
  busy: boolean;
  /** Sends the request; resolves to whether it succeeded. */
  onChange: (request: PublicationRequest) => Promise<boolean>;
}) {
  const id = useId();
  const confirm = useConfirm();
  const [at, setAt] = useState(() => (entry.scheduledAt ? bakuInputValue(entry.scheduledAt) : ""));
  const [error, setError] = useState<string | null>(null);
  const blocked = !canPublish || busy || dirty;

  const run = async (request: PublicationRequest, done: string) => {
    if (await onChange(request)) toast.success(done);
  };

  const schedule = async () => {
    const iso = bakuInputToIso(at);
    if (!iso || new Date(iso).getTime() <= Date.now()) {
      setError(t("publication.schedulePast"));
      return;
    }
    setError(null);
    await run({ publish: true, publishedAt: iso }, t("publication.scheduled"));
  };

  const withdraw = async () => {
    const confirmed = await confirm({
      title: t("publication.unpublishTitle"),
      description: t("publication.unpublishLead"),
      confirmLabel: t("publication.unpublish"),
      destructive: true,
    });
    if (confirmed) await run({ publish: false }, t("publication.unpublished"));
  };

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="font-medium">
          {t("publication.title")}
        </h2>
        <ContentStateBadge state={entry.state} />
      </div>
      <p className="text-sm text-muted-foreground">
        {entry.state === "published" && entry.publishedAt
          ? t("publication.publishedLead", { date: adminDateTime(entry.publishedAt) })
          : entry.state === "scheduled" && entry.scheduledAt
            ? t("publication.scheduledLead", { date: adminDateTime(entry.scheduledAt) })
            : t("publication.draftLead")}
      </p>
      {!canPublish ? (
        <p className="text-sm">{t("publication.denied")}</p>
      ) : dirty ? (
        <p className="text-sm" role="status">
          {t("publication.saveFirst")}
        </p>
      ) : null}

      {entry.state === "published" ? (
        <Button type="button" variant="outline" disabled={blocked} onClick={() => void withdraw()}>
          <Undo2 aria-hidden />
          {t("publication.unpublish")}
        </Button>
      ) : (
        <>
          <Button
            type="button"
            disabled={blocked}
            onClick={() => void run({ publish: true }, t("publication.published"))}
          >
            <Send aria-hidden />
            {t("publication.publishNow")}
          </Button>
          <div className="flex flex-col gap-2 border-t pt-3">
            <Label htmlFor={`${id}-at`}>{t("publication.scheduleAt")}</Label>
            <Input
              id={`${id}-at`}
              type="datetime-local"
              value={at}
              disabled={!canPublish || busy}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
              onChange={(event) => {
                setAt(event.target.value);
                setError(null);
              }}
            />
            <p id={`${id}-hint`} className="text-sm text-muted-foreground">
              {t("publication.scheduleHint")}
            </p>
            {error ? (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={blocked || !at}
              onClick={() => void schedule()}
            >
              <CalendarClock aria-hidden />
              {t("publication.schedule")}
            </Button>
            {entry.state === "scheduled" ? (
              <Button
                type="button"
                variant="ghost"
                disabled={blocked}
                onClick={() => void run({ publish: false }, t("publication.unpublished"))}
              >
                {t("publication.cancelSchedule")}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
