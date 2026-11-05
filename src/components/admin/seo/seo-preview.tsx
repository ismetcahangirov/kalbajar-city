"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { locales, type Locale } from "@/i18n/routing";
import { t } from "@/lib/admin/messages";
import { lengthStatus, localePath, seoLengths, type SeoTexts } from "@/shared/seo-overrides";

/**
 * Each language's length against what a search result shows, as text with an
 * icon, never colour alone. A long text is a warning: it is still saved.
 */
export function LengthHints({ texts, field }: { texts: SeoTexts; field: keyof typeof seoLengths }) {
  const max = seoLengths[field];
  const filled = locales.filter((locale) => lengthStatus(texts[locale], field) !== "empty");
  if (!filled.length) return null;
  return (
    <ul className="text-sm flex flex-col gap-1" data-length-hints={field}>
      {filled.map((locale) => {
        const long = lengthStatus(texts[locale], field) === "long";
        return (
          <li key={locale} className="flex items-start gap-1.5">
            {long ? <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> : null}
            <span className={long ? "font-medium" : "text-muted-foreground"}>
              <span lang={locale}>{locale.toUpperCase()}</span>
              {": "}
              {t("seo.length", { count: texts[locale].trim().length, max })}
              {long ? ` — ${t("seo.tooLong", { max })}` : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Text cut where a search result usually cuts it. */
function clip(value: string, max: number): string {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * How the page could look in a search result, per language: the address, the
 * title and the description, cut at the usual lengths. A blank language shows
 * that the page keeps its own text there.
 */
export function SeoPreview({
  origin,
  path,
  title,
  description,
}: {
  origin: string;
  path: string;
  title: SeoTexts;
  description: SeoTexts;
}) {
  const [locale, setLocale] = useState<Locale>("az");
  const host = origin.replace(/^https?:\/\//, "");
  return (
    <section aria-label={t("seo.preview")} className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-medium">{t("seo.preview")}</h3>
      <Tabs value={locale} onValueChange={(value) => setLocale(value as Locale)}>
        <TabsList aria-label={t("seo.previewLocale")}>
          {locales.map((code) => (
            <TabsTrigger key={code} value={code}>
              <span lang={code}>{code.toUpperCase()}</span>
              <span className="sr-only">{t(`locale.${code}`)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {locales.map((code) => {
          const ownTitle = title[code].trim();
          const ownDescription = description[code].trim();
          const address = `${host}${localePath(path.startsWith("/") ? path : "/", code)}`;
          return (
            <TabsContent key={code} value={code}>
              <div
                lang={code}
                data-seo-preview={code}
                className="bg-card flex min-w-0 flex-col gap-1 rounded-md border p-4"
              >
                <p className="text-sm text-muted-foreground break-all">{address}</p>
                <p className="text-lg text-primary leading-snug break-words">
                  {ownTitle ? (
                    clip(ownTitle, seoLengths.title)
                  ) : (
                    <span className="text-muted-foreground italic">{t("seo.previewTitle")}</span>
                  )}
                </p>
                <p className="text-sm break-words">
                  {ownDescription ? (
                    clip(ownDescription, seoLengths.description)
                  ) : (
                    <span className="text-muted-foreground italic">
                      {t("seo.previewDescription")}
                    </span>
                  )}
                </p>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
