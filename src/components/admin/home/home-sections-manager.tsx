"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { toastApiError } from "@/components/admin/feedback/toast";
import { SortableList } from "@/components/admin/sortable/sortable-list";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Switch } from "@/components/admin/ui/switch";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { t } from "@/lib/admin/messages";
import type { AdminHomeSection, HomeSectionKey } from "@/shared/home-sections";
import {
  useAdminHomeSectionsQuery,
  useSaveHomeSectionOrderMutation,
} from "@/store/endpoints/admin-home-sections";

import { SectionForm, type FormContext } from "./home-section-forms";

const sectionName = (key: HomeSectionKey) => t(`home.section.${key}`);

/** A section's state in words, so colour never carries it alone. */
function VisibleWord({ visible }: { visible: boolean }) {
  return (
    <span className="text-sm text-muted-foreground">
      {visible ? t("home.order.visible") : t("home.order.hidden")}
    </span>
  );
}

/**
 * The home page's sections (#17, #25): the order and visibility, saved at
 * once, then each section's content behind its own disclosure, with its own
 * save button. A form mounts when first opened and stays mounted, so closing
 * a section keeps what was typed and the guard against leaving still sees it.
 */
export function HomeSectionsManager(context: FormContext) {
  const { data, isLoading, isError, error, refetch } = useAdminHomeSectionsQuery();
  const [saveOrder] = useSaveHomeSectionOrderMutation();
  const [opened, setOpened] = useState<ReadonlySet<HomeSectionKey>>(new Set());

  const save = async (next: ReadonlyArray<Pick<AdminHomeSection, "key" | "visible">>) => {
    try {
      await saveOrder(next.map(({ key, visible }) => ({ key, visible }))).unwrap();
    } catch (failure) {
      toastApiError(failure);
    }
  };

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-destructive">{apiErrorMessage(error)}</p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          {t("ui.retry")}
        </Button>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const hero = data.find((section) => section.key === "hero");
  const rest = data
    .filter((section) => section.key !== "hero")
    .map((section) => ({ ...section, id: section.key as string }));

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section aria-labelledby="home-order-heading" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="home-order-heading" className="text-lg font-medium">
            {t("home.order.heading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("home.order.hint")}</p>
          <p className="text-sm text-muted-foreground">{t("home.order.emptyHint")}</p>
        </div>
        <div className="bg-card flex min-w-0 flex-col gap-1 rounded-lg border p-3">
          <span className="font-medium">{sectionName("hero")}</span>
          <span className="text-sm text-muted-foreground">{t("home.order.heroHint")}</span>
        </div>
        <SortableList
          items={rest}
          label={t("home.order.list")}
          itemName={(section) => sectionName(section.key)}
          disabled={context.readOnly}
          onReorder={(ids) =>
            void save([
              ...(hero ? [hero] : []),
              ...ids.flatMap((id) => rest.find((section) => section.id === id) ?? []),
            ])
          }
          renderItem={(section) => (
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="min-w-0 font-medium break-words">{sectionName(section.key)}</span>
              <span className="flex items-center gap-3">
                <VisibleWord visible={section.visible} />
                {/* The label's hit area makes the small switch a 44 px target. */}
                <label className="flex min-h-target min-w-target cursor-pointer items-center justify-center">
                  <Switch
                    aria-label={t("home.order.toggle", { name: sectionName(section.key) })}
                    checked={section.visible}
                    disabled={context.readOnly}
                    onCheckedChange={(visible) =>
                      void save(
                        data.map((other) =>
                          other.key === section.key ? { ...other, visible } : other,
                        ),
                      )
                    }
                  />
                </label>
              </span>
            </div>
          )}
        />
      </section>

      <section aria-labelledby="home-content-heading" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="home-content-heading" className="text-lg font-medium">
            {t("home.content.heading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("home.content.hint")}</p>
        </div>
        <ul className="flex min-w-0 flex-col gap-2">
          {data.map((section) => (
            <li key={section.key} className="bg-card min-w-0 rounded-lg border">
              <details
                data-section={section.key}
                className="group min-w-0"
                onToggle={(event) => {
                  if (!event.currentTarget.open || opened.has(section.key)) return;
                  setOpened(new Set(opened).add(section.key));
                }}
              >
                <summary className="flex min-h-target cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-2 [&::-webkit-details-marker]:hidden">
                  <span className="font-medium">{sectionName(section.key)}</span>
                  <span className="flex items-center gap-2">
                    <VisibleWord visible={section.visible} />
                    <ChevronDown aria-hidden className="size-4 group-open:rotate-180" />
                  </span>
                </summary>
                <div className="border-t p-4">
                  {opened.has(section.key) ? <SectionForm {...context} section={section} /> : null}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
