"use client";

import { Printer, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button, Icon } from "@/components/ui";

/**
 * Share the page (the system share sheet where there is one, otherwise the
 * link goes to the clipboard) and print it (the print stylesheet keeps the
 * plan, the facts and the area table).
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

  return (
    <div className="flex flex-col gap-2" data-print-hidden="">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={share} leadingIcon={<Icon icon={Share2} />}>
          {t("share")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => window.print()}
          leadingIcon={<Icon icon={Printer} />}
        >
          {t("print")}
        </Button>
      </div>
      <p role="status" className="text-small break-all text-text-muted">
        {message}
      </p>
    </div>
  );
}
