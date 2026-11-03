import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/apartments/status-badge";
import { Heading, Text } from "@/components/ui";
import { formatArea, formatNumber } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { publicApartmentStatuses, type PublicApartmentStatus } from "@/shared/apartments";
import {
  blockApartments,
  boxSize,
  canvas,
  facadeLayout,
  floorLayout,
  labelPoint,
  selectionQuery,
  siteLayout,
  statusCounts,
  toSvgPoints,
  type ComplexSelectorData,
  type Polygon,
  type Selection,
  type SelectorApartment,
  type SelectorBlock,
  type SelectorFloor,
} from "@/shared/complex";

import { SelectionFocus } from "./selection-focus";

const headingId = "kompleks-level";

type Props = { data: ComplexSelectorData; selection: Selection; locale: Locale };

const selectorHref = (block?: string, floor?: number) => ({
  pathname: "/kompleks" as const,
  query: selectionQuery(block, floor),
});

/** The words each level needs: names, counts and specs for labels and lists. */
function useLabels(locale: Locale) {
  const t = useTranslations("Complex");
  const apartments = useTranslations("Apartments");
  const card = useTranslations("Catalogue.card");
  const status = useTranslations("Status");

  const counts = (items: readonly SelectorApartment[]) => {
    const c = statusCounts(items);
    return `${apartments("count", { count: c.total })}, ${t("available", { count: c.available })}`;
  };
  return {
    floor: (number: number) => card("floor", { floor: formatNumber(number, locale) }),
    status: (value: PublicApartmentStatus) => status(value),
    counts,
    block: (block: SelectorBlock) =>
      `${block.name.value}, ${block.building.name.value}: ${counts(blockApartments(block))}`,
    floorName: (number: number, items: readonly SelectorApartment[]) =>
      `${card("floor", { floor: formatNumber(number, locale) })}: ${counts(items)}`,
    apartmentName: (block: SelectorBlock, apartment: SelectorApartment) =>
      apartments("name", { block: block.name.value, number: apartment.number }),
    specs: (apartment: SelectorApartment) =>
      [
        card("rooms", { rooms: apartment.rooms }),
        formatArea(Number(apartment.areaTotal), locale),
      ].join(" · "),
  };
}

/**
 * The interactive complex selector: a schematic plan with a hotspot per
 * block, per floor of the chosen block, and per apartment of the chosen
 * floor, plus the same data as links and as a list. Every choice is a link
 * to `/kompleks?blok=A&mertebe=3`, so it works without JavaScript, can be
 * shared, and the back button undoes it.
 */
export function ComplexSelector({ data, selection, locale }: Props) {
  const t = useTranslations("Complex");
  const labels = useLabels(locale);
  const { block, floor } = selection;

  if (!data.blocks.length) {
    return <Text tone="muted">{t("empty")}</Text>;
  }

  const heading = !block
    ? t("headingBlocks")
    : !floor
      ? t("headingFloors", { block: block.name.value })
      : t("headingApartments", {
          block: block.name.value,
          floor: formatNumber(floor.number, locale),
        });

  return (
    <div className="flex flex-col gap-block">
      <SelectionFocus
        target={headingId}
        selection={`${block?.code ?? ""}/${floor?.number ?? ""}`}
      />
      <PatternDefs />

      <div className="flex flex-col gap-6">
        <ChoiceNav label={t("blocksNav")}>
          {data.blocks.map((item) => (
            <Choice
              key={item.code}
              href={selectorHref(item.code)}
              current={item.code === block?.code}
              label={labels.block(item)}
            >
              {item.code}
            </Choice>
          ))}
        </ChoiceNav>
        {block && (
          <ChoiceNav label={t("floorsNav")}>
            {block.floors.map((item) => (
              <Choice
                key={item.number}
                href={selectorHref(block.code, item.number)}
                current={item.number === floor?.number}
                label={labels.floorName(item.number, item.apartments)}
              >
                {formatNumber(item.number, locale)}
              </Choice>
            ))}
          </ChoiceNav>
        )}
      </div>

      <div className="grid gap-block lg:grid-cols-12 lg:gap-gutter">
        <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <div className="flex flex-col gap-4">
            <Trail selection={selection} locale={locale} />
            <Heading
              as="h2"
              size="heading"
              id={headingId}
              tabIndex={-1}
              className="scroll-mt-(--header-height)"
            >
              {heading}
            </Heading>
            {floor && <Legend />}
          </div>
          <figure className="flex flex-col gap-3">
            <div className="rounded-md bg-surface-alt p-2 sm:p-4">
              {!block ? (
                <BlocksPlan data={data} locale={locale} />
              ) : !floor ? (
                <FloorsPlan block={block} locale={locale} />
              ) : (
                <ApartmentsPlan block={block} floor={floor} locale={locale} />
              )}
            </div>
            <figcaption className="text-small text-text-muted">{t("schematic")}</figcaption>
          </figure>
        </section>

        <section
          aria-labelledby="kompleks-list"
          className="flex min-w-0 flex-col gap-4 lg:col-span-4"
        >
          <div className="flex flex-col gap-1">
            <Heading as="h2" size="title" id="kompleks-list">
              {t("listTitle")}
            </Heading>
            <Text size="small" tone="muted">
              {t("listLead")}
            </Text>
          </div>
          {!block ? (
            <BlocksList data={data} locale={locale} />
          ) : !floor ? (
            <FloorsList block={block} locale={locale} />
          ) : (
            <ApartmentsList block={block} floor={floor} locale={locale} />
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation

function ChoiceNav({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="flex flex-col gap-2">
      <p aria-hidden className="text-eyebrow text-text-muted uppercase">
        {label}
      </p>
      <ul className="flex flex-wrap gap-2">{children}</ul>
    </nav>
  );
}

function Choice({
  href,
  current,
  label,
  children,
}: {
  href: ReturnType<typeof selectorHref>;
  current: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-label={label}
        aria-current={current ? "true" : undefined}
        className={cx(
          "inline-flex min-h-target min-w-target items-center justify-center rounded-full border px-4 text-body font-medium",
          current
            ? "border-action bg-action text-action-text"
            : "border-border-strong text-text hover:bg-surface-alt",
        )}
      >
        {children}
      </Link>
    </li>
  );
}

/** Where the selection is: all blocks › block › floor, each a way back. */
function Trail({ selection, locale }: { selection: Selection; locale: Locale }) {
  const t = useTranslations("Complex");
  const labels = useLabels(locale);
  const { block, floor } = selection;
  const steps: Array<{ label: string; href: ReturnType<typeof selectorHref> }> = [
    { label: t("allBlocks"), href: selectorHref() },
  ];
  if (block) steps.push({ label: block.name.value, href: selectorHref(block.code) });
  if (block && floor) {
    steps.push({ label: labels.floor(floor.number), href: selectorHref(block.code, floor.number) });
  }
  return (
    <nav aria-label={t("trail")}>
      <ol className="flex flex-wrap items-center gap-x-2 text-small text-text-muted">
        {steps.map((step, index) => {
          const last = index === steps.length - 1;
          return (
            <li key={step.label} className="flex items-center gap-2">
              {last ? (
                <span aria-current="location" className="text-text">
                  {step.label}
                </span>
              ) : (
                <>
                  <Link
                    href={step.href}
                    scroll={false}
                    className="inline-flex min-h-target items-center underline underline-offset-4"
                  >
                    {step.label}
                  </Link>
                  <span aria-hidden>/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Status patterns and legend

const patternId = (status: PublicApartmentStatus) => `kompleks-pattern-${status}`;

/** Fills for reserved (hatched) and sold (cross-hatched); available is plain. */
function PatternDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <pattern
          id={patternId("reserved")}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="16" strokeWidth="5" className="stroke-status-reserved" />
        </pattern>
        <pattern
          id={patternId("sold")}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path d="M0 0V14M0 0H14" strokeWidth="3" className="stroke-status-sold" />
        </pattern>
      </defs>
    </svg>
  );
}

/** A status's pattern over the shape, faint enough for the text above it. */
function StatusFill({ status, points }: { status: PublicApartmentStatus; points: string }) {
  if (status === "available") return null;
  return (
    <polygon
      points={points}
      fill={`url(#${patternId(status)})`}
      opacity={0.3}
      pointerEvents="none"
    />
  );
}

function Legend() {
  const t = useTranslations("Complex");
  const status = useTranslations("Status");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-eyebrow text-text-muted uppercase">{t("legend")}</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {publicApartmentStatuses.map((value) => (
          <li key={value} className="flex items-center gap-2 text-small">
            <svg aria-hidden viewBox="0 0 40 28" className="h-7 w-10">
              <g className="kompleks-hotspot" data-status={value}>
                <polygon points="3,3 37,3 37,25 3,25" className="kompleks-shape" />
                <StatusFill status={value} points="3,3 37,3 37,25 3,25" />
              </g>
            </svg>
            {status(value)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plans

function Plan({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      role="group"
      aria-label={label}
      className="kompleks-plan"
    >
      {children}
    </svg>
  );
}

function Hotspot({
  href,
  label,
  polygon,
  status,
  testId,
  children,
}: {
  href: Parameters<typeof Link>[0]["href"];
  label: string;
  polygon: Polygon;
  status?: PublicApartmentStatus;
  testId: string;
  children: ReactNode;
}) {
  const points = toSvgPoints(polygon);
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className="kompleks-hotspot"
      data-status={status}
      data-hotspot={testId}
    >
      <polygon points={points} className="kompleks-shape" />
      {status && <StatusFill status={status} points={points} />}
      <g aria-hidden>{children}</g>
      <polygon points={points} className="kompleks-focus" />
    </Link>
  );
}

/** Font sizes that fit a hotspot, in user units, capped for large shapes. */
function fit(polygon: Polygon, big: number, small: number) {
  const { width, height } = boxSize(polygon);
  return {
    big: Math.round(Math.min(big, height * 0.32, width * 0.3)),
    small: Math.round(Math.min(small, height * 0.16, width * 0.13)),
  };
}

function BlocksPlan({ data, locale }: { data: ComplexSelectorData; locale: Locale }) {
  const t = useTranslations("Complex");
  const status = useTranslations("Status");
  const labels = useLabels(locale);
  const layout = siteLayout(data.blocks);
  return (
    <Plan label={t("figureBlocks")}>
      {data.blocks.map((block) => {
        const polygon = layout.get(block.code);
        if (!polygon) return null;
        const { x, y } = labelPoint(polygon);
        const size = fit(polygon, 120, 30);
        const available = statusCounts(blockApartments(block)).available;
        return (
          <Hotspot
            key={block.code}
            href={selectorHref(block.code)}
            label={labels.block(block)}
            polygon={polygon}
            testId={`blok-${block.code}`}
          >
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size.big}
              className="kompleks-summary fill-text font-light"
            >
              {block.code}
            </text>
            <g className="kompleks-detail">
              <text
                x={x}
                y={y - size.small * 0.6}
                textAnchor="middle"
                fontSize={size.big * 0.6}
                className="fill-text font-light"
              >
                {formatNumber(available, locale)}
              </text>
              <text
                x={x}
                y={y + size.small * 1.4}
                textAnchor="middle"
                fontSize={size.small}
                className="fill-text"
              >
                {status("available")}
              </text>
            </g>
          </Hotspot>
        );
      })}
    </Plan>
  );
}

function FloorsPlan({ block, locale }: { block: SelectorBlock; locale: Locale }) {
  const t = useTranslations("Complex");
  const labels = useLabels(locale);
  const layout = facadeLayout(block.floors.map((floor) => floor.number));
  return (
    <Plan label={t("figureFloors", { block: block.name.value })}>
      {block.floors.map((floor) => {
        const polygon = layout.get(floor.number);
        if (!polygon) return null;
        const [[left] = [0, 0], [right] = [0, 0]] = polygon;
        const { y } = labelPoint(polygon);
        const { height } = boxSize(polygon);
        const size = Math.round(Math.min(44, height * 0.36));
        return (
          <Hotspot
            key={floor.number}
            href={selectorHref(block.code, floor.number)}
            label={labels.floorName(floor.number, floor.apartments)}
            polygon={polygon}
            testId={`mertebe-${floor.number}`}
          >
            <text
              x={left * canvas.width + 28}
              y={y}
              dominantBaseline="central"
              fontSize={size}
              className="fill-text"
            >
              {labels.floor(floor.number)}
            </text>
            <text
              x={right * canvas.width - 28}
              y={y}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={size * 0.75}
              className="fill-text-muted"
            >
              {t("available", { count: statusCounts(floor.apartments).available })}
            </text>
          </Hotspot>
        );
      })}
    </Plan>
  );
}

function ApartmentsPlan({
  block,
  floor,
  locale,
}: {
  block: SelectorBlock;
  floor: SelectorFloor;
  locale: Locale;
}) {
  const t = useTranslations("Complex");
  const labels = useLabels(locale);
  const card = useTranslations("Catalogue.card");
  const cells = floorLayout(floor.apartments.length);
  return (
    <Plan
      label={t("figureApartments", {
        block: block.name.value,
        floor: formatNumber(floor.number, locale),
      })}
    >
      {floor.apartments.map((apartment, index) => {
        const polygon = cells[index];
        if (!polygon) return null;
        const { x, y } = labelPoint(polygon);
        const size = fit(polygon, 72, 34);
        const line = size.small * 1.35;
        return (
          <Hotspot
            key={apartment.slug}
            href={{ pathname: "/menziller/[slug]", params: { slug: apartment.slug } }}
            label={`${labels.apartmentName(block, apartment)}: ${labels.specs(apartment)}, ${labels.status(apartment.status)}`}
            polygon={polygon}
            status={apartment.status}
            testId={`menzil-${apartment.slug}`}
          >
            <g className="kompleks-summary">
              <text
                x={x}
                y={y - size.small * 0.4}
                textAnchor="middle"
                fontSize={size.big}
                className={cx(
                  "font-light",
                  apartment.status === "sold" ? "fill-text-muted" : "fill-text",
                )}
              >
                {apartment.number}
              </text>
              <text
                x={x}
                y={y + line}
                textAnchor="middle"
                fontSize={size.small}
                className="fill-text font-medium"
              >
                {labels.status(apartment.status)}
              </text>
            </g>
            <g className="kompleks-detail">
              <text
                x={x}
                y={y - line}
                textAnchor="middle"
                fontSize={size.small}
                className="fill-text"
              >
                {card("rooms", { rooms: apartment.rooms })}
              </text>
              <text x={x} y={y} textAnchor="middle" fontSize={size.small} className="fill-text">
                {formatArea(Number(apartment.areaTotal), locale)}
              </text>
              <text
                x={x}
                y={y + line}
                textAnchor="middle"
                fontSize={size.small}
                className="fill-text font-medium"
              >
                {labels.status(apartment.status)}
              </text>
            </g>
          </Hotspot>
        );
      })}
    </Plan>
  );
}

// ---------------------------------------------------------------------------
// Lists: the same data, readable at any width and by any input

const rowLink = cx(
  "after:absolute after:inset-0 focus-visible:outline-none underline-offset-4 hover:underline",
  "focus-visible:after:outline-(length:--focus-ring-width) focus-visible:after:outline-offset-(--focus-ring-offset) focus-visible:after:outline-focus focus-visible:after:outline-solid",
);

function Row({ children }: { children: ReactNode }) {
  return (
    <li className="relative flex min-h-target flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-3">
      {children}
    </li>
  );
}

function BlocksList({ data, locale }: { data: ComplexSelectorData; locale: Locale }) {
  const labels = useLabels(locale);
  return (
    <ul className="border-t border-border">
      {data.blocks.map((block) => (
        <Row key={block.code}>
          <Link
            href={selectorHref(block.code)}
            scroll={false}
            className={cx("text-title", rowLink)}
          >
            {block.name.value}
          </Link>
          <span className="text-small text-text-muted">
            {block.building.name.value} · {labels.counts(blockApartments(block))}
          </span>
        </Row>
      ))}
    </ul>
  );
}

function FloorsList({ block, locale }: { block: SelectorBlock; locale: Locale }) {
  const labels = useLabels(locale);
  return (
    <ul className="border-t border-border">
      {[...block.floors].reverse().map((floor) => (
        <Row key={floor.number}>
          <Link
            href={selectorHref(block.code, floor.number)}
            scroll={false}
            className={cx("text-title", rowLink)}
          >
            {labels.floor(floor.number)}
          </Link>
          <span className="text-small text-text-muted">{labels.counts(floor.apartments)}</span>
        </Row>
      ))}
    </ul>
  );
}

function ApartmentsList({
  block,
  floor,
  locale,
}: {
  block: SelectorBlock;
  floor: SelectorFloor;
  locale: Locale;
}) {
  const labels = useLabels(locale);
  return (
    <ul className="border-t border-border">
      {floor.apartments.map((apartment) => (
        <Row key={apartment.slug}>
          <span className="flex flex-col">
            <Link
              href={{ pathname: "/menziller/[slug]", params: { slug: apartment.slug } }}
              className={cx("text-title", rowLink)}
            >
              {labels.apartmentName(block, apartment)}
            </Link>
            <span className="text-small text-text-muted">{labels.specs(apartment)}</span>
          </span>
          <StatusBadge status={apartment.status} />
        </Row>
      ))}
    </ul>
  );
}
