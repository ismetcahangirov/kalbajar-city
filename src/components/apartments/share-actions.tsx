"use client";

import { Printer, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { RoundButton } from "@/components/ui/round-button";

/**
 * Share the page (the system share sheet where there is one, otherwise the
 * link goes to the clipboard) and print it (the print stylesheet keeps the
 * plan, the facts and the area table): two round buttons on the theme. The
 * outcome of sharing is announced to screen readers; the visible result is
 * the sheet or the clipboard.
 */
export function ShareActions({ title }: { title: string }) {
  const t = useTranslations("ApartmentPage");
  const [message, setMessage] = useState("");

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // The visitor closed the sheet; anything else falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage(t("copied"));
    } catch {
      setMessage(t("copyFailed", { url }));
    }
  }

  const icon = { width: 16, height: 16, strokeWidth: 1, "aria-hidden": true, focusable: false };
  return (
    <div className="flex items-center" data-print-hidden="">
      <RoundButton label={t("share")} icon={<Share2 {...icon} />} onClick={share} />
      <RoundButton label={t("print")} icon={<Printer {...icon} />} onClick={() => window.print()} />
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  );
}
