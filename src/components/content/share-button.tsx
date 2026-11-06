"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RoundButton } from "@/components/ui/round-button";

/**
 * Shares the page through the system share sheet where there is one (Web
 * Share API), and copies its address otherwise. The result is announced:
 * written beside the labelled button, and for screen readers only beside the
 * round one, where the visible result is the sheet or the clipboard.
 */
export function ShareButton({
  title,
  appearance = "button",
}: {
  title: string;
  appearance?: "button" | "round";
}) {
  const t = useTranslations("Share");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const message = status === "idle" ? "" : t(status);

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

  if (appearance === "round") {
    return (
      <>
        <RoundButton
          label={t("share")}
          icon={<Share2 width={16} height={16} strokeWidth={1} aria-hidden focusable={false} />}
          onClick={share}
        />
        <p role="status" className="sr-only">
          {message}
        </p>
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button variant="secondary" onClick={share} leadingIcon={<Icon icon={Share2} />}>
        {t("share")}
      </Button>
      <p role="status" className="text-small text-text-muted">
        {message}
      </p>
    </div>
  );
}
