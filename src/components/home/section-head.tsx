import { FadeUp, LineReveal } from "@/components/motion";
import { Eyebrow, Text } from "@/components/ui";
import type { Localized as LocalizedValue } from "@/i18n/content";
import { cx } from "@/lib/cx";

import { Localized } from "./localized";

type SectionHeadProps = {
  id: string;
  title: LocalizedValue;
  eyebrow?: LocalizedValue | null;
  lead?: LocalizedValue | null;
  align: "start" | "center";
};

/**
 * Eyebrow, display heading and lead. Heads alternate between start and centre
 * down the page (ui-kit → Spacing and layout); the heading enters with
 * `LineReveal`, the rest with `FadeUp`.
 */
export function SectionHead({ id, title, eyebrow, lead, align }: SectionHeadProps) {
  const centred = align === "center";
  return (
    <div className={cx("flex flex-col gap-4", centred && "items-center text-center")}>
      {eyebrow && (
        <FadeUp>
          <Eyebrow>
            <Localized text={eyebrow} />
          </Eyebrow>
        </FadeUp>
      )}
      <LineReveal
        as="h2"
        id={id}
        size="display"
        align={align}
        className="max-w-(--container-prose)"
        lang={title.fallback ? title.locale : undefined}
      >
        {title.value}
      </LineReveal>
      {lead && (
        <FadeUp>
          <Text size="body-lg" tone="muted" className="max-w-(--container-prose)">
            <Localized text={lead} />
          </Text>
        </FadeUp>
      )}
    </div>
  );
}
