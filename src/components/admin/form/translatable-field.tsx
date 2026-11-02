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

import { Button } from "@/components/admin/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/admin/ui/form";
import { Input } from "@/components/admin/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { Textarea } from "@/components/admin/ui/textarea";
import type { Translatable } from "@/i18n/content";
import { defaultLocale, locales, type Locale } from "@/i18n/routing";
import { t } from "@/lib/admin/messages";
import { missingLocales } from "@/lib/admin/translatables";

/**
 * One translatable text (`{ az, en, ru }`, `translatableSchema`): a tab per
 * language, a marker on each tab whose translation is missing, an error
 * marker on tabs with an invalid value, and "copy from az" to start a
 * translation from the Azerbaijani text. An empty `en`/`ru` is allowed: the
 * site shows `az` instead.
 */
export function TranslatableField<T extends FieldValues>({
  name,
  label,
  multiline = false,
}: {
  /** The path of the `{ az, en, ru }` object in the form. */
  name: Path<T>;
  label: string;
  multiline?: boolean;
}) {
  const { control, getFieldState, setValue } = useFormContext<T>();
  const value = useWatch({ control, name }) as Partial<Translatable> | undefined;
  const formState = useFormState({ control, name });
  const missing = missingLocales(value);
  const path = (locale: Locale) => `${name}.${locale}` as Path<T>;

  const copyFromAz = (locale: Locale) =>
    setValue(path(locale), (value?.az ?? "") as PathValue<T, Path<T>>, {
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
                  <FormLabel>
                    {label} ({t(`locale.${locale}`)})
                  </FormLabel>
                  <FormControl>
                    {multiline ? (
                      <Textarea {...field} value={field.value ?? ""} lang={locale} />
                    ) : (
                      <Input {...field} value={field.value ?? ""} lang={locale} />
                    )}
                  </FormControl>
                  {locale !== defaultLocale ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      disabled={!value?.az?.trim()}
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
