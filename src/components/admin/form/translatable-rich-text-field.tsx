"use client";

import { CircleAlert, CircleDashed, Copy } from "lucide-react";
import {
  useFormContext,
  useFormState,
  useWatch,
  type FieldValues,
  type Path,
  type PathValue,
} from "react-hook-form";

import { RichTextEditor } from "@/components/admin/content/rich-text-editor";
import { Button } from "@/components/admin/ui/button";
import { FormField, FormItem, FormMessage, useFormField } from "@/components/admin/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { defaultLocale, locales, type Locale } from "@/i18n/routing";
import { t } from "@/lib/admin/messages";
import { missingRichLocales } from "@/lib/admin/translatables";
import { hasRichContent, type RichTextDoc, type TranslatableRichText } from "@/shared/rich-text";

/**
 * One translatable rich text (`translatableRichTextSchema`), like
 * `TranslatableField`: a tab per language with an editor, a marker on each
 * tab whose translation is missing or invalid, and "copy from az". An empty
 * `en`/`ru` is allowed: the site shows `az` instead.
 */
export function TranslatableRichTextField<T extends FieldValues>({
  name,
  label,
  canUpload = false,
  disabled = false,
}: {
  name: Path<T>;
  label: string;
  canUpload?: boolean;
  disabled?: boolean;
}) {
  const { control, getFieldState, setValue } = useFormContext<T>();
  const value = useWatch({ control, name }) as Partial<TranslatableRichText> | undefined;
  const formState = useFormState({ control, name });
  const missing = missingRichLocales(value);
  const path = (locale: Locale) => `${name}.${locale}` as Path<T>;

  const copyFromAz = (locale: Locale) =>
    setValue(path(locale), structuredClone(value?.az ?? null) as PathValue<T, Path<T>>, {
      shouldDirty: true,
      shouldValidate: true,
    });

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm mb-2 font-medium">{label}</legend>
      <Tabs defaultValue={defaultLocale}>
        <TabsList aria-label={label}>
          {locales.map((locale) => {
            const invalid = Boolean(getFieldState(path(locale), formState).error);
            return (
              <TabsTrigger key={locale} value={locale} className="gap-1.5">
                <span lang={locale}>{locale.toUpperCase()}</span>
                <span className="sr-only">{t(`locale.${locale}`)}</span>
                {invalid ? (
                  <CircleAlert aria-label={t("error.invalid")} className="text-destructive" />
                ) : missing.includes(locale) ? (
                  <CircleDashed aria-label={t("form.missingTranslation")} />
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {locales.map((locale) => (
          <TabsContent key={locale} value={locale}>
            <FormField
              control={control}
              name={path(locale)}
              render={({ field }) => (
                <FormItem>
                  <LocaleEditor
                    value={field.value as RichTextDoc | null | undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    label={`${label} (${t(`locale.${locale}`)})`}
                    locale={locale}
                    canUpload={canUpload}
                    disabled={disabled}
                  />
                  {locale !== defaultLocale ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      disabled={disabled || !hasRichContent(value?.az)}
                      onClick={() => copyFromAz(locale)}
                    >
                      <Copy aria-hidden />
                      {t("form.copyFromAz")}
                    </Button>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-sm text-muted-foreground">{t("form.translationHint")}</p>
    </fieldset>
  );
}

/** The editor wired to its `FormItem`'s error and message ids. */
function LocaleEditor(
  props: Omit<Parameters<typeof RichTextEditor>[0], "invalid" | "describedBy">,
) {
  const { error, formMessageId } = useFormField();
  return (
    <RichTextEditor
      {...props}
      invalid={Boolean(error)}
      describedBy={error ? formMessageId : undefined}
    />
  );
}
