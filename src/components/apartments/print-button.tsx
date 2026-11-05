"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";

import { RoundButton } from "@/components/ui/round-button";

/** Prints the page; the print stylesheet keeps the plan, the facts and the area table. */
export function PrintButton() {
  const t = useTranslations("ApartmentPage");
  return (
    <RoundButton
      label={t("print")}
      icon={<Printer width={16} height={16} strokeWidth={1} aria-hidden focusable={false} />}
      onClick={() => window.print()}
    />
  );
}
