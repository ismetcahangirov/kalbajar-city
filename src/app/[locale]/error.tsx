"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";

/**
 * A page that failed to render, inside the site's shell and in the page's
 * language: try again, or go on to the catalogue or the home page. The
 * details stay in the server log; production sends only a digest.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("ErrorPage");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    // The same frame as the 404 (`PlaceholderFrame`, which is server-only).
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-layout py-u6 text-center desk:py-u9">
      <h1 className="text-lead-lg text-balance">{t("title")}</h1>
      <p className="text-body text-pretty text-(--t-small)">{t("body")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()} leadingIcon={<Icon icon={RotateCcw} />}>
          {t("retry")}
        </Button>
        <Link href="/menziller" className={buttonClass({ variant: "secondary" })}>
          {t("catalogue")}
        </Link>
        <Link href="/" className={buttonClass({ variant: "link" })}>
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
