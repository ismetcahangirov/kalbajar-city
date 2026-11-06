"use client";

import Link from "next/link";
import { useFieldArray, useFormContext, useWatch, type Path } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

import { SelectField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { useAdminForm } from "@/components/admin/form/use-admin-form";
import { ListEditor } from "@/components/admin/settings/list-editor";
import { MediaField } from "@/components/admin/settings/media-field";
import { MediaListField } from "@/components/admin/settings/media-list-field";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { SortableList } from "@/components/admin/sortable/sortable-list";
import { FormField, FormItem, FormMessage } from "@/components/admin/ui/form";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import {
  aboutFormSchema,
  aboutToForm,
  amenitiesFormSchema,
  amenitiesToForm,
  cardZoomFormSchema,
  cardZoomToForm,
  ctaFormSchema,
  ctaToForm,
  heroFormSchema,
  heroToForm,
  layoutsFormSchema,
  layoutsToForm,
  processFormSchema,
  processToForm,
  statsFormSchema,
  statsToForm,
  titleFormSchema,
  titleToForm,
  type AboutForm as AboutValues,
  type AmenitiesForm as AmenitiesValues,
  type CardZoomForm as CardZoomValues,
  type CtaForm as CtaValues,
  type FeaturedRoom,
  type HeroForm as HeroValues,
  type LayoutsForm as LayoutsValues,
  type ProcessForm as ProcessValues,
  type StatsForm as StatsValues,
  type TitleForm as TitleValues,
} from "@/lib/admin/home-section-forms";
import { t, type MessageKey } from "@/lib/admin/messages";
import type { AdminHomeSection, HomeSectionContentByKey } from "@/shared/home-sections";
import { complexFactKeys, type ComplexFactKey } from "@/shared/settings";
import {
  useUpdateHomeSectionMutation,
  type HomeSectionUpdate,
} from "@/store/endpoints/admin-home-sections";

/** What every section's form is told. */
export type FormContext = {
  readOnly: boolean;
  canUpload: boolean;
  /** The room counts that have layouts, with how many plans each. */
  roomCounts: ReadonlyArray<{ rooms: number; plans: number }>;
};

type Props<K extends keyof HomeSectionContentByKey> = FormContext & {
  content: HomeSectionContentByKey[K];
};

/** Saves one section and answers its stored content. */
function useSave() {
  const [save] = useUpdateHomeSectionMutation();
  return async <K extends keyof HomeSectionContentByKey>(
    key: K,
    content: HomeSectionContentByKey[K],
  ) => {
    const saved = await save({ key, content } as HomeSectionUpdate).unwrap();
    return saved.content as HomeSectionContentByKey[K];
  };
}

/** An image slot of the form in context, by field name. */
function Picture<T extends FieldValues>({
  name,
  label,
  description,
  kind,
  hasDefault = true,
  readOnly,
  canUpload,
}: {
  name: Path<T>;
  label: string;
  description?: string;
  kind?: "image" | "video";
  hasDefault?: boolean;
  readOnly: boolean;
  canUpload: boolean;
}) {
  const { control, setValue } = useFormContext<T>();
  const value = useWatch({ control, name }) as string | null | undefined;
  return (
    <MediaField
      label={label}
      description={description}
      kind={kind}
      hasDefault={hasDefault}
      value={value ?? null}
      disabled={readOnly}
      canUpload={canUpload}
      onChange={(id) => setValue(name, id as never, { shouldDirty: true, shouldValidate: true })}
    />
  );
}

/** Where the rest of a section's data is edited. */
function Elsewhere({ href, label }: { href: string; label: MessageKey }) {
  return (
    <p className="text-sm">
      {t("home.editElsewhere")}{" "}
      <Link href={href} className="underline underline-offset-4">
        {t(label)}
      </Link>
    </p>
  );
}

export function HeroForm({ content, readOnly, canUpload }: Props<"hero">) {
  const save = useSave();
  const form = useAdminForm(heroFormSchema, { defaultValues: heroToForm(content) });
  const media = { readOnly, canUpload };
  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => heroToForm(await save("hero", value))}
    >
      <TranslatableField<HeroValues> name="title" label={t("home.field.title")} />
      <TranslatableField<HeroValues> name="subtitle" label={t("home.field.subtitle")} />
      <Picture<HeroValues>
        name="panelMediaId"
        label={t("home.field.panel")}
        description={t("home.field.panelHint")}
        {...media}
      />
      <Picture<HeroValues>
        name="posterMediaId"
        label={t("home.field.poster")}
        description={t("home.field.posterHint")}
        {...media}
      />
      <Picture<HeroValues>
        name="videoMediaId"
        label={t("home.field.video")}
        description={t("home.field.videoHint")}
        kind="video"
        hasDefault={false}
        {...media}
      />
    </SettingsForm>
  );
}

export function StatsForm({ content, readOnly, canUpload }: Props<"stats">) {
  const save = useSave();
  const form = useAdminForm(statsFormSchema, { defaultValues: statsToForm(content) });
  const items = useFieldArray({ control: form.control, name: "items" });
  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => statsToForm(await save("stats", value))}
    >
      <Elsewhere href="/admin/ayarlar/kompleks" label="home.link.complex" />
      <ListEditor
        legend={t("home.stats.items")}
        description={t("home.stats.itemsHint")}
        ids={items.fields.map((field) => field.id)}
        itemLabel={(index) => t("home.stats.item", { index: index + 1 })}
        renderItem={(index) => (
          <>
            <SelectField<StatsValues>
              name={`items.${index}.fact`}
              label={t("home.stats.fact")}
              disabled={readOnly}
              options={complexFactKeys.map((fact: ComplexFactKey) => ({
                value: fact,
                label: t(`home.fact.${fact}`),
              }))}
            />
            <TranslatableField<StatsValues>
              name={`items.${index}.label`}
              label={t("home.stats.label")}
            />
          </>
        )}
        onMove={items.move}
        onRemove={items.remove}
        onAdd={() => items.append({ fact: "totalArea", label: { az: "", en: "", ru: "" } })}
        addLabel={t("home.stats.add")}
        emptyText={t("home.stats.empty")}
        max={6}
        disabled={readOnly}
      />
      <Picture<StatsValues>
        name="backgroundMediaId"
        label={t("home.field.background")}
        readOnly={readOnly}
        canUpload={canUpload}
      />
    </SettingsForm>
  );
}

export function AboutForm({ content, readOnly, canUpload }: Props<"about">) {
  const save = useSave();
  const form = useAdminForm(aboutFormSchema, { defaultValues: aboutToForm(content) });
  const media = { readOnly, canUpload };
  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => aboutToForm(await save("about", value))}
    >
      <TranslatableField<AboutValues> name="eyebrow" label={t("home.field.eyebrow")} />
      <TranslatableField<AboutValues> name="title" label={t("home.field.title")} multiline />
      <TranslatableField<AboutValues> name="body" label={t("home.field.body")} multiline />
      <Picture<AboutValues> name="mediaId" label={t("home.field.image")} {...media} />
      <Picture<AboutValues>
        name="backgroundMediaId"
        label={t("home.field.background")}
        {...media}
      />
    </SettingsForm>
  );
}

/** Which room counts show and in what order; one row per room count, as on the site. */
function FeaturedRooms({
  readOnly,
  plansOf,
}: {
  readOnly: boolean;
  plansOf: (rooms: number) => number;
}) {
  const { control } = useFormContext<LayoutsValues>();
  return (
    <FormField
      control={control}
      name="featuredRooms"
      render={({ field }) => {
        const list = (field.value ?? []) as FeaturedRoom[];
        const rows = list.map((row) => ({ ...row, id: String(row.rooms) }));
        const name = (rooms: number) => t("home.layouts.room", { rooms });
        return (
          <FormItem>
            <fieldset className="flex min-w-0 flex-col gap-3">
              <legend className="text-sm mb-2 font-medium">{t("home.layouts.featured")}</legend>
              <p className="text-sm text-muted-foreground">{t("home.layouts.featuredHint")}</p>
              {rows.length ? (
                <SortableList
                  items={rows}
                  label={t("home.layouts.featured")}
                  itemName={(row) => name(row.rooms)}
                  disabled={readOnly}
                  onReorder={(ids) =>
                    field.onChange(
                      ids.flatMap((id) => list.find((row) => String(row.rooms) === id) ?? []),
                    )
                  }
                  renderItem={(row) => (
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <Label htmlFor={`featured-${row.rooms}`}>{name(row.rooms)}</Label>
                        <span className="text-sm text-muted-foreground">
                          {t("home.layouts.plans", { count: plansOf(row.rooms) })}
                        </span>
                      </div>
                      <span className="flex min-h-target min-w-target items-center justify-center">
                        <Switch
                          id={`featured-${row.rooms}`}
                          aria-label={t("home.layouts.toggle", { name: name(row.rooms) })}
                          checked={row.shown}
                          disabled={readOnly}
                          onCheckedChange={(shown) =>
                            field.onChange(
                              list.map((other) =>
                                other.rooms === row.rooms ? { ...other, shown } : other,
                              ),
                            )
                          }
                        />
                      </span>
                    </div>
                  )}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("home.layouts.none")}</p>
              )}
            </fieldset>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

export function LayoutsForm({ content, readOnly, canUpload, roomCounts }: Props<"layouts">) {
  const save = useSave();
  const available = roomCounts.map(({ rooms }) => rooms);
  const form = useAdminForm(layoutsFormSchema, {
    defaultValues: layoutsToForm(content, available),
  });
  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => layoutsToForm(await save("layouts", value), available)}
    >
      <TranslatableField<LayoutsValues> name="title" label={t("home.field.title")} />
      <TranslatableField<LayoutsValues> name="body" label={t("home.field.body")} multiline />
      <FeaturedRooms
        readOnly={readOnly}
        plansOf={(rooms) => roomCounts.find((count) => count.rooms === rooms)?.plans ?? 0}
      />
      <Picture<LayoutsValues>
        name="backgroundMediaId"
        label={t("home.field.background")}
        readOnly={readOnly}
        canUpload={canUpload}
      />
    </SettingsForm>
  );
}

export function AmenitiesForm({ content, readOnly, canUpload }: Props<"amenities">) {
  const save = useSave();
  const form = useAdminForm(amenitiesFormSchema, { defaultValues: amenitiesToForm(content) });
  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => amenitiesToForm(await save("amenities", value))}
    >
      <Elsewhere href="/admin/ayarlar/kompleks" label="home.link.complex" />
      <TranslatableField<AmenitiesValues> name="title" label={t("home.field.title")} />
      <Picture<AmenitiesValues>
        name="windowMediaId"
        label={t("home.field.window")}
        readOnly={readOnly}
        canUpload={canUpload}
      />
    </SettingsForm>
  );
}

export function CardZoomForm({ content, readOnly, canUpload }: Props<"card_zoom">) {
  const save = useSave();
  const form = useAdminForm(cardZoomFormSchema, { defaultValues: cardZoomToForm(content) });
  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => cardZoomToForm(await save("card_zoom", value))}
    >
      <TranslatableField<CardZoomValues> name="title" label={t("home.field.title")} />
      <MediaListField<CardZoomValues>
        name="items"
        control={form.control}
        legend={t("home.cards.items")}
        description={t("home.cards.itemsHint")}
        itemLabel={(index) => t("home.cards.item", { index: index + 1 })}
        imageLabel={t("home.cards.image")}
        addLabel={t("home.cards.add")}
        emptyText={t("home.cards.empty")}
        max={8}
        disabled={readOnly}
        canUpload={canUpload}
        newRow={{ caption: { az: "", en: "", ru: "" } }}
        renderExtra={(index) => (
          <TranslatableField<CardZoomValues>
            name={`items.${index}.caption`}
            label={t("home.cards.caption")}
          />
        )}
      />
    </SettingsForm>
  );
}

/** A section that only has a title here: the construction teaser and the FAQ. */
function TitleOnlyForm({
  sectionKey,
  content,
  readOnly,
}: {
  sectionKey: "construction" | "faq";
  content: HomeSectionContentByKey["faq"];
  readOnly: boolean;
}) {
  const save = useSave();
  const form = useAdminForm(titleFormSchema, { defaultValues: titleToForm(content) });
  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => titleToForm(await save(sectionKey, value))}
    >
      <TranslatableField<TitleValues> name="title" label={t("home.field.title")} />
    </SettingsForm>
  );
}

export function ConstructionForm({ content, readOnly }: Props<"construction">) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("home.construction.hint")}</p>
      <TitleOnlyForm sectionKey="construction" content={content} readOnly={readOnly} />
    </div>
  );
}

export function FaqTitleForm({ content, readOnly }: Props<"faq">) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("home.faq.hint")}</p>
      <Elsewhere href="/admin/xeberler/suallar" label="home.link.faq" />
      <TitleOnlyForm sectionKey="faq" content={content} readOnly={readOnly} />
    </div>
  );
}

export function ProcessForm({ content, readOnly }: Props<"process">) {
  const save = useSave();
  const form = useAdminForm(processFormSchema, { defaultValues: processToForm(content) });
  const steps = useFieldArray({ control: form.control, name: "steps" });
  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => processToForm(await save("process", value))}
    >
      <TranslatableField<ProcessValues> name="title" label={t("home.field.title")} />
      <ListEditor
        legend={t("home.process.steps")}
        ids={steps.fields.map((field) => field.id)}
        itemLabel={(index) => t("home.process.step", { index: index + 1 })}
        renderItem={(index) => (
          <>
            <TranslatableField<ProcessValues>
              name={`steps.${index}.title`}
              label={t("home.process.stepTitle")}
            />
            <TranslatableField<ProcessValues>
              name={`steps.${index}.body`}
              label={t("home.process.stepBody")}
              multiline
            />
          </>
        )}
        onMove={steps.move}
        onRemove={steps.remove}
        onAdd={() =>
          steps.append({ title: { az: "", en: "", ru: "" }, body: { az: "", en: "", ru: "" } })
        }
        addLabel={t("home.process.add")}
        emptyText={t("home.process.empty")}
        min={1}
        max={8}
        disabled={readOnly}
      />
    </SettingsForm>
  );
}

export function CtaForm({ content, readOnly, canUpload }: Props<"cta">) {
  const save = useSave();
  const form = useAdminForm(ctaFormSchema, { defaultValues: ctaToForm(content) });
  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => ctaToForm(await save("cta", value))}
    >
      <TranslatableField<CtaValues> name="title" label={t("home.field.title")} multiline />
      <TranslatableField<CtaValues> name="body" label={t("home.field.body")} multiline />
      <Picture<CtaValues>
        name="portraitMediaId"
        label={t("home.field.portrait")}
        description={t("home.field.portraitHint")}
        readOnly={readOnly}
        canUpload={canUpload}
      />
    </SettingsForm>
  );
}

function LocationNote() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("home.location.hint")}</p>
      <Elsewhere href="/admin/ayarlar/yerlesme" label="home.link.location" />
    </div>
  );
}

/** The right form for a section. */
export function SectionForm({ section, ...context }: FormContext & { section: AdminHomeSection }) {
  switch (section.key) {
    case "hero":
      return <HeroForm {...context} content={section.content as Props<"hero">["content"]} />;
    case "stats":
      return <StatsForm {...context} content={section.content as Props<"stats">["content"]} />;
    case "about":
      return <AboutForm {...context} content={section.content as Props<"about">["content"]} />;
    case "layouts":
      return <LayoutsForm {...context} content={section.content as Props<"layouts">["content"]} />;
    case "amenities":
      return (
        <AmenitiesForm {...context} content={section.content as Props<"amenities">["content"]} />
      );
    case "card_zoom":
      return (
        <CardZoomForm {...context} content={section.content as Props<"card_zoom">["content"]} />
      );
    case "location":
      return <LocationNote />;
    case "construction":
      return (
        <ConstructionForm
          {...context}
          content={section.content as Props<"construction">["content"]}
        />
      );
    case "process":
      return <ProcessForm {...context} content={section.content as Props<"process">["content"]} />;
    case "faq":
      return <FaqTitleForm {...context} content={section.content as Props<"faq">["content"]} />;
    case "cta":
      return <CtaForm {...context} content={section.content as Props<"cta">["content"]} />;
  }
}
