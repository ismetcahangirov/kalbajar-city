import { MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui";
import { contacts, mainPhone, whatsappHref } from "@/config/contacts";
import { telHref } from "@/i18n/format";
import { cx } from "@/lib/cx";

const half =
  "relative flex min-h-control-lg flex-1 items-center justify-center gap-2 text-body font-medium focus-visible:z-10";

/**
 * Call and WhatsApp, always within reach below `lg` (spec §4). The footer
 * reserves `--action-bar-space` so the bar never covers its last line.
 */
export function MobileActionBar() {
  const t = useTranslations("Shell");
  return (
    <aside
      aria-label={t("quickContact")}
      className="fixed inset-x-0 bottom-0 z-30 px-page pb-(--action-bar-inset) lg:hidden"
    >
      <div className="flex rounded-full shadow-raised">
        <a
          href={telHref(mainPhone)}
          data-track="click_call"
          className={cx(half, "rounded-s-full bg-action text-action-text")}
        >
          <Icon icon={Phone} />
          {t("call")}
        </a>
        <a
          href={whatsappHref(contacts.whatsapp, t("whatsappMessage"))}
          data-track="click_whatsapp"
          rel="noopener noreferrer"
          className={cx(half, "rounded-e-full bg-surface-raised text-text")}
        >
          <Icon icon={MessageCircle} />
          {t("whatsapp")}
        </a>
      </div>
    </aside>
  );
}
