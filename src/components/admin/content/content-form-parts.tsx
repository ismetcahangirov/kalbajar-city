"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { Button } from "@/components/admin/ui/button";
import { t } from "@/lib/admin/messages";
import type { ContentState } from "@/shared/content";
import type { RichTextDoc, TranslatableRichText } from "@/shared/rich-text";

import { PublicationPanel, type PublicationRequest } from "./publication-panel";

const emptyDoc: RichTextDoc = { type: "doc", content: [{ type: "paragraph" }] };

/** A stored rich text as a form's value: every language has a document to edit. */
export const richTextValues = (value?: TranslatableRichText | null) => ({
  az: value?.az ?? emptyDoc,
  en: value?.en ?? emptyDoc,
  ru: value?.ru ?? emptyDoc,
});

/** Asks, deletes, tells, and goes back to the list. */
export function useDeleteEntry({
  texts,
  remove,
  listHref,
  onDeleted,
}: {
  texts: { title: string; lead: string; confirm: string; done: string };
  remove: () => Promise<unknown>;
  listHref: string;
  /** Runs before leaving, so the unsaved-changes guard has nothing to ask about. */
  onDeleted: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  return async () => {
    const confirmed = await confirm({
      title: texts.title,
      description: texts.lead,
      confirmLabel: texts.confirm,
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove();
      onDeleted();
      toast.success(texts.done);
      router.push(listHref);
    } catch (error) {
      toastApiError(error);
    }
  };
}

/** Save or create, and delete when the entry exists and the role may. */
export function ContentFormActions({
  exists,
  saving,
  busy,
  deleteLabel,
  onDelete,
}: {
  exists: boolean;
  saving: boolean;
  busy: boolean;
  deleteLabel: string;
  /** Left out when the role may not delete. */
  onDelete?: () => void;
}) {
  const label = exists
    ? t(saving ? "content.saving" : "content.save")
    : t(saving ? "content.creating" : "content.create");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" disabled={busy}>
        {label}
      </Button>
      {exists && onDelete ? (
        <Button
          type="button"
          variant="outline"
          className="text-destructive ml-auto"
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2 aria-hidden />
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** The publication panel, and a link to the page once the entry is live. */
export function ContentAside({
  entry,
  canPublish,
  dirty,
  busy,
  publicHref,
  onChange,
}: {
  entry: { state: ContentState; publishedAt: string | null; scheduledAt: string | null };
  canPublish: boolean;
  dirty: boolean;
  busy: boolean;
  publicHref: string;
  onChange: (request: PublicationRequest) => Promise<boolean>;
}) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
      <PublicationPanel
        entry={entry}
        canPublish={canPublish}
        dirty={dirty}
        busy={busy}
        onChange={onChange}
      />
      {entry.state === "published" ? (
        <Button asChild variant="outline" className="self-start">
          <a href={publicHref} target="_blank" rel="noopener">
            <ExternalLink aria-hidden />
            {t("content.view")}
          </a>
        </Button>
      ) : null}
    </aside>
  );
}
