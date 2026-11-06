"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";

import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { SortableList } from "@/components/admin/sortable/sortable-list";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { t } from "@/lib/admin/messages";
import { faqCreateSchema, faqPlaceholders, type AdminFaq, type FaqCreate } from "@/shared/faq";
import {
  useAdminFaqQuery,
  useCreateFaqMutation,
  useDeleteFaqMutation,
  useReorderFaqMutation,
  useUpdateFaqMutation,
} from "@/store/endpoints/admin-faq-gallery";

import {
  DialogForm,
  EditDialog,
  EntryFlags,
  PublishedField,
  translatableValues,
} from "./dialog-form";

export type ContentAbilities = {
  create: boolean;
  update: boolean;
  delete: boolean;
  publish: boolean;
};

/**
 * The FAQ (#25): questions and answers in three languages, in the order the
 * home page shows them and the `FAQPage` structured data lists them.
 */
export function FaqManager({ abilities }: { abilities: ContentAbilities }) {
  const { data, isLoading, isError, error, refetch } = useAdminFaqQuery();
  const [reorder] = useReorderFaqMutation();
  const [remove] = useDeleteFaqMutation();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ item?: AdminFaq } | null>(null);

  const onReorder = async (ids: string[]) => {
    try {
      await reorder(ids).unwrap();
    } catch (failure) {
      toastApiError(failure);
    }
  };

  const onDelete = async (item: AdminFaq) => {
    const confirmed = await confirm({
      title: t("faq.deleteTitle"),
      description: item.question.az,
      confirmLabel: t("faq.delete"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove(item.id).unwrap();
      toast.success(t("structure.deleted"));
    } catch (failure) {
      toastApiError(failure);
    }
  };

  return (
    <section aria-labelledby="faq-heading" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="faq-heading" className="text-lg font-medium">
            {t("faq.list")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("faq.orderHint")}</p>
        </div>
        {abilities.create ? (
          <Button type="button" onClick={() => setEditing({})}>
            <Plus aria-hidden />
            {t("faq.new")}
          </Button>
        ) : null}
      </div>

      {isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-destructive">{apiErrorMessage(error)}</p>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            {t("ui.retry")}
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <p className="rounded-md border border-dashed p-6">{t("faq.empty")}</p>
      ) : (
        <SortableList
          items={data}
          label={t("faq.list")}
          itemName={(item) => item.question.az}
          disabled={!abilities.update}
          onReorder={(ids) => void onReorder(ids)}
          renderItem={(item) => (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="font-medium break-words">{item.question.az}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3 break-words">
                  {item.answer.az}
                </p>
                <EntryFlags status={item.status} texts={[item.question, item.answer]} />
              </div>
              <span className="flex shrink-0 gap-1">
                {abilities.update ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("structure.edit", { name: item.question.az })}
                    onClick={() => setEditing({ item })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                ) : null}
                {abilities.delete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("structure.delete", { name: item.question.az })}
                    onClick={() => void onDelete(item)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </span>
            </div>
          )}
        />
      )}

      <EditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.item ? t("faq.edit") : t("faq.new")}
      >
        {editing ? (
          <FaqForm
            item={editing.item}
            canPublish={abilities.publish}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </EditDialog>
    </section>
  );
}

function FaqForm({
  item,
  canPublish,
  onDone,
}: {
  item?: AdminFaq;
  canPublish: boolean;
  onDone: () => void;
}) {
  const [create, created] = useCreateFaqMutation();
  const [update, updated] = useUpdateFaqMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(faqCreateSchema, {
    defaultValues: {
      question: translatableValues(item?.question),
      answer: translatableValues(item?.answer),
      status: item?.status ?? (canPublish ? "published" : "draft"),
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      if (item) await update({ id: item.id, ...values }).unwrap();
      else await create(values).unwrap();
      toast.success(t("structure.saved"));
      onDone();
    } catch (failure) {
      setAlert(applyApiErrors(form, failure));
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
      <TranslatableField<FaqCreate> name="question" label={t("faq.question")} />
      <TranslatableField<FaqCreate> name="answer" label={t("faq.answer")} multiline />
      <p className="text-sm text-muted-foreground">{t("faq.answerHint")}</p>
      <FaqPlaceholderHint />
      <PublishedField<FaqCreate> name="status" disabled={!canPublish} />
    </DialogForm>
  );
}

/** The facts a question or answer can quote; the site fills them in (#29). */
function FaqPlaceholderHint() {
  return (
    <section
      aria-labelledby="faq-placeholders-heading"
      className="text-sm flex flex-col gap-2 rounded-md border p-3"
    >
      <h3 id="faq-placeholders-heading" className="font-medium">
        {t("faq.placeholders")}
      </h3>
      <p className="text-muted-foreground">{t("faq.placeholdersHint")}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1">
        {faqPlaceholders.map((name) => (
          <Fragment key={name}>
            <dt>
              <code className="font-mono">{`{${name}}`}</code>
            </dt>
            <dd className="text-muted-foreground break-words">{t(`faq.placeholder.${name}`)}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
