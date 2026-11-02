import {
  AppWindow,
  ArrowRight,
  Baby,
  DoorOpen,
  Fence,
  FireExtinguisher,
  Flame,
  MessageCircle,
  Phone,
  Plus,
  ShieldCheck,
  SquareParking,
  type LucideIcon,
} from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { LeadForm } from "@/components/leads/lead-form";
import { CountUp, FadeUp, ImageReveal, PinnedCardZoom } from "@/components/motion";
import {
  Button,
  Card,
  Container,
  Heading,
  Icon,
  Picture,
  Section,
  Stat,
  Text,
  type Tone,
} from "@/components/ui";
import { contacts, mainPhone, whatsappHref } from "@/config/contacts";
import { formatArea, formatNumber, formatPercent, telHref, unitSymbol } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import type { Amenity, HomeSection } from "@/lib/public/home";

import { Localized } from "./localized";
import { SectionHead } from "./section-head";

type Props<K extends HomeSection["kind"]> = Extract<HomeSection, { kind: K }> & {
  tone: Tone;
  align: "start" | "center";
};

async function pageLocale(): Promise<Locale> {
  return (await getLocale()) as Locale;
}

export async function Stats({ items, tone }: Props<"stats">) {
  const locale = await pageLocale();
  const t = await getTranslations("Home.stats");
  return (
    <Section tone={tone} aria-label={t("label")}>
      <Container>
        <dl className="grid grid-cols-2 gap-x-gutter gap-y-block lg:grid-cols-4">
          {items.map((item) => {
            const digits = item.unit === "ha" ? 2 : 0;
            return (
              <Stat
                key={item.fact}
                value={item.value}
                locale={locale}
                unit={item.unit ? unitSymbol(item.unit, locale) : undefined}
                label={item.label.value}
                maximumFractionDigits={digits}
                numeral={
                  <CountUp value={item.value} locale={locale} maximumFractionDigits={digits} />
                }
              />
            );
          })}
        </dl>
      </Container>
    </Section>
  );
}

export function About({ eyebrow, title, body, image, tone, align }: Props<"about">) {
  return (
    <Section tone={tone} aria-labelledby="haqqinda">
      <Container
        className={cx("grid items-center gap-block", image && "lg:grid-cols-2 lg:gap-gutter")}
      >
        <div className="flex flex-col gap-block">
          <SectionHead
            id="haqqinda"
            eyebrow={eyebrow}
            title={title}
            align={image ? "start" : align}
          />
          <FadeUp>
            <Text
              size="body-lg"
              className={cx(
                "max-w-(--container-prose)",
                !image && align === "center" && "mx-auto text-center",
              )}
            >
              <Localized text={body} />
            </Text>
          </FadeUp>
        </div>
        {image && (
          <ImageReveal className="relative aspect-portrait overflow-hidden rounded-md">
            <Picture image={image} sizes="(min-width: 64rem) 50vw, 100vw" />
          </ImageReveal>
        )}
      </Container>
    </Section>
  );
}

export async function Layouts({ title, body, groups, tone, align }: Props<"layouts">) {
  const locale = await pageLocale();
  const t = await getTranslations("Home.layouts");
  const range = (min: number, max: number) =>
    min === max
      ? formatArea(min, locale)
      : `${formatNumber(min, locale, { maximumFractionDigits: 2 })}–${formatArea(max, locale)}`;
  return (
    <Section tone={tone} aria-labelledby="planlar">
      <Container className="flex flex-col gap-block">
        <SectionHead id="planlar" title={title} lead={body} align={align} />
        <FadeUp as="ul" group className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((group) => (
            <li key={group.rooms}>
              <Card
                title={t("rooms", { rooms: formatNumber(group.rooms, locale) })}
                href={getPathname({
                  href: { pathname: "/menziller", query: { otaq: String(group.rooms) } },
                  locale,
                })}
                meta={`${range(group.areaMin, group.areaMax)} · ${t("plans", { count: group.plans })}`}
                media={
                  group.image ? (
                    <Picture
                      image={group.image}
                      sizes="(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-full items-end p-6 text-stat text-text-muted"
                    >
                      {formatNumber(group.rooms, locale)}
                    </span>
                  )
                }
              />
            </li>
          ))}
        </FadeUp>
        <div className={cx("flex", align === "center" && "justify-center")}>
          <Button
            href={getPathname({ href: "/menziller", locale })}
            variant="secondary"
            trailingIcon={<Icon icon={ArrowRight} />}
          >
            {t("all")}
          </Button>
        </div>
      </Container>
    </Section>
  );
}

const amenityIcons: Record<Amenity, LucideIcon> = {
  security: ShieldCheck,
  "fire-safety": FireExtinguisher,
  playground: Baby,
  windows: AppWindow,
  gas: Flame,
  lobby: DoorOpen,
  perimeter: Fence,
  parking: SquareParking,
};

export function Amenities({ title, items, tone, align }: Props<"amenities">) {
  return (
    <Section tone={tone} aria-labelledby="ustunlukler">
      <Container className="flex flex-col gap-block">
        <SectionHead id="ustunlukler" title={title} align={align} />
        <FadeUp
          as="ul"
          group
          className="grid gap-x-gutter gap-y-block sm:grid-cols-2 lg:grid-cols-4"
        >
          {items.map((item) => (
            <li
              key={item.icon + item.title.value}
              className="flex flex-col gap-4 border-t border-border pt-6"
            >
              <span className="text-text-accent">
                <Icon icon={amenityIcons[item.icon]} size={24} />
              </span>
              <Heading as="h3" size="title">
                <Localized text={item.title} />
              </Heading>
              {item.body && (
                <Text size="small" tone="muted">
                  <Localized text={item.body} />
                </Text>
              )}
            </li>
          ))}
        </FadeUp>
      </Container>
    </Section>
  );
}

export function CardZoom({ title, scenes, tone, align }: Props<"card_zoom">) {
  return (
    <Section tone={tone} aria-labelledby="menzereler" className="flex flex-col gap-block">
      <Container>
        <SectionHead id="menzereler" title={title} align={align} />
      </Container>
      <PinnedCardZoom
        aria-labelledby="menzereler"
        scenes={scenes.map((scene) => ({
          key: scene.key,
          media: <Picture image={scene.image} sizes="100vw" />,
          caption: scene.caption ? (
            <Text size="body-lg">
              <Localized text={scene.caption} />
            </Text>
          ) : null,
        }))}
      />
    </Section>
  );
}

export async function Location({ title, body, map, distances, tone, align }: Props<"location">) {
  const locale = await pageLocale();
  const t = await getTranslations("Home.location");
  return (
    <Section tone={tone} aria-labelledby="yerlesme">
      <Container
        className={cx("grid gap-block", map && "lg:grid-cols-2 lg:items-center lg:gap-gutter")}
      >
        <div className="flex flex-col gap-block">
          <SectionHead id="yerlesme" title={title} lead={body} align={map ? "start" : align} />
          {distances.length > 0 && (
            <FadeUp as="dl" group className="flex flex-col">
              {distances.map((d) => (
                <div
                  key={d.place.value}
                  className="flex items-baseline justify-between gap-4 border-t border-border py-4"
                >
                  <dt>
                    <Localized text={d.place} />
                  </dt>
                  <dd className="text-end text-text-muted">
                    {t("minutes", { minutes: formatNumber(d.minutes, locale) })}
                  </dd>
                </div>
              ))}
            </FadeUp>
          )}
          <div>
            <Button
              href={getPathname({ href: "/yerlesme", locale })}
              variant="link"
              trailingIcon={<Icon icon={ArrowRight} />}
            >
              {t("more")}
            </Button>
          </div>
        </div>
        {map && (
          <ImageReveal className="relative aspect-grid overflow-hidden rounded-md">
            <Picture image={map} sizes="(min-width: 64rem) 50vw, 100vw" />
          </ImageReveal>
        )}
      </Container>
    </Section>
  );
}

export async function Construction({ title, update, tone, align }: Props<"construction">) {
  const locale = await pageLocale();
  const t = await getTranslations("Home.construction");
  const format = await getFormatter();
  const month = format.dateTime(new Date(`${update.month}T00:00:00Z`), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <Section tone={tone} aria-labelledby="tikinti">
      <Container
        className={cx(
          "grid gap-block",
          update.image && "lg:grid-cols-2 lg:items-center lg:gap-gutter",
        )}
      >
        <div className="flex flex-col gap-block">
          <SectionHead id="tikinti" title={title} align={update.image ? "start" : align} />
          <FadeUp className="flex flex-col gap-4">
            <Text size="small" tone="muted">
              {t("asOf", { month })}
            </Text>
            <Heading as="h3" size="heading">
              <Localized text={update.title} />
            </Heading>
            <p className="text-title">
              {t("progress", { percent: formatPercent(update.progress, locale) })}
            </p>
            <div aria-hidden className="h-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full origin-left bg-text-accent"
                style={{ transform: `scaleX(${update.progress / 100})` }}
              />
            </div>
            <div>
              <Button
                href={getPathname({ href: "/tikinti", locale })}
                variant="link"
                trailingIcon={<Icon icon={ArrowRight} />}
              >
                {t("more")}
              </Button>
            </div>
          </FadeUp>
        </div>
        {update.image && (
          <ImageReveal className="relative aspect-grid overflow-hidden rounded-md">
            <Picture image={update.image} sizes="(min-width: 64rem) 50vw, 100vw" />
          </ImageReveal>
        )}
      </Container>
    </Section>
  );
}

export async function Process({ title, steps, tone, align }: Props<"process">) {
  const locale = await pageLocale();
  return (
    <Section tone={tone} aria-labelledby="addimlar">
      <Container className="flex flex-col gap-block">
        <SectionHead id="addimlar" title={title} align={align} />
        <FadeUp
          as="ol"
          group
          className="grid gap-x-gutter gap-y-block sm:grid-cols-2 lg:grid-cols-5"
        >
          {steps.map((step, i) => (
            <li key={step.title.value} className="flex flex-col gap-3 border-t border-border pt-6">
              <span aria-hidden className="text-stat text-text-muted">
                {formatNumber(i + 1, locale, { minimumIntegerDigits: 2, useGrouping: false })}
              </span>
              <Heading as="h3" size="title">
                <Localized text={step.title} />
              </Heading>
              <Text tone="muted">
                <Localized text={step.body} />
              </Text>
            </li>
          ))}
        </FadeUp>
      </Container>
    </Section>
  );
}

export function Faq({ title, items, tone, align }: Props<"faq">) {
  return (
    <Section tone={tone} aria-labelledby="suallar">
      <Container size="prose" className="flex flex-col gap-block">
        <SectionHead id="suallar" title={title} align={align} />
        <FadeUp className="flex flex-col border-b border-border">
          {items.map((item) => (
            <details key={item.question.value} className="group border-t border-border">
              <summary className="flex min-h-target cursor-pointer items-center justify-between gap-4 py-5 text-title">
                <Localized text={item.question} />
                <span data-accordion-icon="" className="shrink-0 text-text-muted">
                  <Icon icon={Plus} size={24} />
                </span>
              </summary>
              <Text tone="muted" className="pb-6">
                <Localized text={item.answer} />
              </Text>
            </details>
          ))}
        </FadeUp>
      </Container>
    </Section>
  );
}

export async function Cta({ title, body, tone }: Props<"cta">) {
  const locale = await pageLocale();
  const t = await getTranslations("Home.hero");
  const shell = await getTranslations("Shell");
  return (
    <Section tone={tone} aria-labelledby="muraciet">
      <Container className="grid gap-block lg:grid-cols-12 lg:gap-gutter">
        <div className="flex flex-col gap-block lg:col-span-5">
          <SectionHead id="muraciet" title={title} lead={body} align="start" />
          <FadeUp className="flex flex-col items-start gap-3">
            <Button
              href={telHref(mainPhone)}
              data-track="click_call"
              variant="secondary"
              leadingIcon={<Icon icon={Phone} />}
            >
              {shell("call")}
            </Button>
            <Button
              href={whatsappHref(contacts.whatsapp)}
              data-track="click_whatsapp"
              rel="noopener noreferrer"
              variant="secondary"
              leadingIcon={<Icon icon={MessageCircle} />}
            >
              {shell("whatsapp")}
            </Button>
            <Button
              href={`${getPathname({ href: "/elaqe", locale })}#baxis`}
              variant="link"
              trailingIcon={<Icon icon={ArrowRight} />}
            >
              {t("viewing")}
            </Button>
          </FadeUp>
        </div>
        {/* The inquiry form; forms never animate, so it is not wrapped in an entry. */}
        <div className="rounded-md bg-surface-raised p-6 lg:col-span-7 lg:p-10">
          <LeadForm type="inquiry" labelledBy="muraciet" />
        </div>
      </Container>
    </Section>
  );
}
