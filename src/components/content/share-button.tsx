"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button, Icon } from "@/components/ui";

/**
 * Shares the page through the system share sheet where there is one (Web
 * Share API), and copies its address otherwise. The result is announced.
 */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("Share");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function share() {
    const url = window.location.href.split("#")[0]!;
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
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button variant="secondary" onClick={share} leadingIcon={<Icon icon={Share2} />}>
        {t("share")}
      </Button>
      <p role="status" className="text-small text-text-muted">
        {status === "idle" ? "" : t(status)}
      </p>
    </div>
  );
}
