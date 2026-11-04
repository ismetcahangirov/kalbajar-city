import { ArrowRight, BedDouble, Building2, Ruler } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Parallax } from "@/components/motion";
import { Button, Container, Heading, Icon, Picture, Text } from "@/components/ui";
import { formatArea, formatNumber } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { HomeSection } from "@/lib/public/home";

import { HeroVideo } from "./hero-video";
import { Localized } from "./localized";

type HeroProps = Extract<HomeSection, { kind: "hero" }>;

/**
 * Full-height opening on `night`. With a poster it is a full-bleed photo (the
 * LCP element) under a scrim, drifting at half the scroll speed; the film, if
 * any, fades in over it after load. Nothing here starts hidden.
 */
export async function Hero({ title, subtitle, poster, video, chips }: HeroProps) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Home.hero");
  return (
    <div
      data-header-overlay=""
      data-tone="night"
      className="relative isolate flex min-h-svh items-end overflow-hidden"
    >
      {poster && (
        <>
          {/* Positioned here: Parallax's own `relative` would win over an
              `absolute` passed to it, putting the media in the flex row. */}
          <div className="absolute inset-0 -z-20">
            <Parallax variant="hero" className="size-full">
              <div data-hero-media="" className="relative">
                <Picture image={poster} sizes="100vw" priority />
                {video && <HeroVideo video={video} />}
              </div>
            </Parallax>
          </div>
          {/* Scrim from night 55 % to clear, under the text only (ui-kit → Imagery). */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-linear-to-t from-surface/55 via-surface/25 to-transparent"
          />
        </>
      )}
      <Container className="flex w-full flex-col gap-block pt-[calc(var(--header-height)+var(--spacing-block))] pb-block">
        <div className="flex flex-col gap-6">
          <Heading as="h1" size="display-xl" lang={title.fallback ? title.locale : undefined}>
            {title.value}
          </Heading>
          {subtitle && (
            <Text size="body-lg" tone="muted" className="max-w-(--container-prose)">
              <Localized text={subtitle} />
            </Text>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            href={getPathname({ href: "/menziller", locale })}
            size="lg"
            trailingIcon={<Icon icon={ArrowRight} />}
          >
            {t("apartments")}
          </Button>
          <Button href={getPathname({ href: "/elaqe", locale })} size="lg" variant="secondary">
            {t("viewing")}
          </Button>
        </div>
        {chips && (
          <ul aria-label={t("chips")} className="flex flex-wrap gap-2">
            <Chip icon={Building2}>{t("chipApartments", { count: chips.apartments })}</Chip>
            <Chip icon={BedDouble}>
              {t("chipRooms", {
                min: formatNumber(chips.roomsMin, locale),
                max: formatNumber(chips.roomsMax, locale),
              })}
            </Chip>
            <Chip icon={Ruler}>{t("chipArea", { area: formatArea(chips.areaMin, locale) })}</Chip>
          </ul>
        )}
      </Container>
    </div>
  );
}

function Chip({ icon, children }: { icon: typeof Ruler; children: string }) {
  return (
    <li className="inline-flex items-center gap-2 rounded-xs bg-surface-raised/60 px-3 py-2 text-small text-text">
      <Icon icon={icon} />
      {children}
    </li>
  );
}
