import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";

import { formats } from "./format";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: requested }) => {
  // An explicit locale (getTranslations({ locale })) wins over the segment.
  const candidate = requested ?? (await rootParams.locale());
  if (!hasLocale(routing.locales, candidate)) notFound();

  return {
    locale: candidate,
    messages: (await import(`./messages/${candidate}.json`)).default,
    formats,
    timeZone: "Asia/Baku",
  };
});
