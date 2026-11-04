import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/apartments/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatArea, formatNumber } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { publicApartmentStatuses, type PublicApartmentStatus } from "@/shared/apartments";
import {
  blockApartments,
  boxSize,
  canvas,
  drawnView,
  facadeLayout,
  floorLayout,
  labelPoint,
  selectionQuery,
  siteLayout,
  statusCounts,
  toSvgPoints,
  type Canvas,
  type ComplexSelectorData,
  type Polygon,
  type Selection,
  type SelectorApartment,
  type SelectorBlock,
  type SelectorFloor,
  type SelectorPicture,
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
    return <p className="text-body">{t("empty")}</p>;
  }

  // The level's picture, once every hotspot on it is drawn in the console.
  const view = !block
    ? drawnView(
        data.site,
        data.blocks.map((item) => item.sitePolygon),
      )
    : !floor
      ? drawnView(
          block.facade,
          block.floors.map((item) => item.facadePolygon),
        )
      : drawnView(
          floor.plan,
          floor.apartments.map((item) => item.planPolygon),
        );

  const heading = !block
    ? t("headingBlocks")
    : !floor
      ? t("headingFloors", { block: block.name.value })
      : t("headingApartments", {
          block: block.name.value,
          floor: formatNumber(floor.number, locale),
        });

  return (
    <div className="flex flex-col gap-u4">
      <SelectionFocus
        target={headingId}
        selection={`${block?.code ?? ""}/${floor?.number ?? ""}`}
      />
      <PatternDefs />

      <div className="flex flex-col gap-u2">
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

      <div className="grid gap-u4 lg:grid-cols-3">
        <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-u2 lg:col-span-2">
          <div className="flex flex-col gap-u">
            <Trail selection={selection} locale={locale} />
            <h2
              id={headingId}
              tabIndex={-1}
              className="scroll-mt-(--header-height) text-title break-words hyphens-auto text-(--t-primary) uppercase"
            >
              {heading}
            </h2>
            {floor && <Legend />}
          </div>
          <figure className="flex flex-col gap-u">
            {/* The plan on the page's ground inside a hairline frame. */}
            <div className="border border-(--t-line) p-u">
              {!block ? (
                <BlocksPlan data={data} view={view} locale={locale} />
              ) : !floor ? (
                <FloorsPlan block={block} view={view} locale={locale} />
              ) : (
                <ApartmentsPlan block={block} floor={floor} view={view} locale={locale} />
              )}
            </div>
            <Caption picture={view?.picture ?? null} />
          </figure>
        </section>

        <section aria-labelledby="kompleks-list" className="flex min-w-0 flex-col gap-u2 lg:ps-u">
          <div className="flex flex-col gap-u">
            <h2 id="kompleks-list" className="text-label text-(--t-small) uppercase">
              {t("listTitle")}
            </h2>
            <p className="text-small-t text-(--t-small)">{t("listLead")}</p>
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
    <nav aria-label={label} className="flex flex-col gap-u">
      <p aria-hidden className="text-label text-(--t-small) uppercase">
        {label}
      </p>
      {/* Segmented cells joined by their borders (ui-kit.md → Segmented); instant states. */}
      <ul className="flex flex-wrap ps-px">{children}</ul>
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
    <li className="-ms-px -mt-px">
      <Link
        href={href}
        scroll={false}
        aria-label={label}
        aria-current={current ? "true" : undefined}
        className={cx(
          "relative inline-flex min-h-target min-w-target items-center justify-center border px-u text-body",
          current
            ? "z-1 border-(--t-text) bg-(--t-text) text-(--t-bg)"
            : "border-(--t-control) text-(--t-text) hover:z-1 hover:border-(--t-text)",
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
      <ol className="flex flex-wrap items-center gap-x-u text-label text-(--t-small) uppercase">
        {steps.map((step, index) => {
          const last = index === steps.length - 1;
          return (
            <li key={step.label} className="flex items-center gap-2">
              {last ? (
                <span aria-current="location">{step.label}</span>
              ) : (
                <>
                  <Link
                    href={step.href}
                    scroll={false}
                    className="inline-flex min-h-target items-center underline decoration-1 underline-offset-4"
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
    <div className="flex flex-col gap-u">
      <p className="text-label text-(--t-small) uppercase">{t("legend")}</p>
      <ul className="flex flex-wrap gap-x-u2 gap-y-u">
        {publicApartmentStatuses.map((value) => (
          <li key={value} className="flex items-center gap-u text-small-t">
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

/** A level drawn on its picture, or null for the schematic layout. */
type View = { picture: SelectorPicture; canvas: Canvas } | null;

/** What the plan shows: the schematic's note, or the picture's own caption. */
function Caption({ picture }: { picture: SelectorPicture | null }) {
  const t = useTranslations("Complex");
  const media = useTranslations("Media");
  if (!picture) {
    return <figcaption className="text-small-t text-(--t-small)">{t("schematic")}</figcaption>;
  }
  return (
    <figcaption className="flex flex-wrap items-center gap-u text-small-t text-(--t-small)">
      {picture.illustrative && <Badge variant="illustrative">{media("illustrative")}</Badge>}
      <span>{picture.alt ? `${picture.alt}. ${t("drawn")}` : t("drawn")}</span>
    </figcaption>
  );
}

/**
 * The drawing: the schematic's blank canvas, or the picture under the
 * hotspots drawn on it, at the picture's own aspect ratio.
 */
function Plan({ label, view, children }: { label: string; view: View; children: ReactNode }) {
  const size = view?.canvas ?? canvas;
  return (
    <svg
      viewBox={`0 0 ${size.width} ${size.height}`}
      role="group"
      aria-label={label}
      className="kompleks-plan"
      data-picture={view ? "" : undefined}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
    >
      {view && (
        // The figure's label and the hotspots' names say what it shows.
        <image
          href={view.picture.src}
          width={size.width}
          height={size.height}
          preserveAspectRatio="none"
          aria-hidden
        />
      )}
      {children}
    </svg>
  );
}

function Hotspot({
  href,
  label,
  polygon,
  size,
  status,
  testId,
  children,
}: {
  href: Parameters<typeof Link>[0]["href"];
  label: string;
  polygon: Polygon;
  size: Canvas;
  status?: PublicApartmentStatus;
  testId: string;
  children: ReactNode;
}) {
  const points = toSvgPoints(polygon, size);
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
function fit(polygon: Polygon, size: Canvas, big: number, small: number) {
  const { width, height } = boxSize(polygon, size);
  return {
    big: Math.round(Math.min(big, height * 0.32, width * 0.3)),
    small: Math.round(Math.min(small, height * 0.16, width * 0.13)),
  };
}

function BlocksPlan({
  data,
  view,
  locale,
}: {
  data: ComplexSelectorData;
  view: View;
  locale: Locale;
}) {
  const t = useTranslations("Complex");
  const status = useTranslations("Status");
  const labels = useLabels(locale);
  const layout = view ? null : siteLayout(data.blocks);
  const area = view?.canvas ?? canvas;
  return (
    <Plan label={t("figureBlocks")} view={view}>
      {data.blocks.map((block) => {
        const polygon = layout ? layout.get(block.code) : block.sitePolygon;
        if (!polygon) return null;
        const { x, y } = labelPoint(polygon, area);
        const size = fit(polygon, area, 120, 30);
        const available = statusCounts(blockApartments(block)).available;
        return (
          <Hotspot
            key={block.code}
            href={selectorHref(block.code)}
            label={labels.block(block)}
            polygon={polygon}
            size={area}
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

function FloorsPlan({ block, view, locale }: { block: SelectorBlock; view: View; locale: Locale }) {
  const t = useTranslations("Complex");
  const labels = useLabels(locale);
  const layout = view ? null : facadeLayout(block.floors.map((floor) => floor.number));
  const area = view?.canvas ?? canvas;
  return (
    <Plan label={t("figureFloors", { block: block.name.value })} view={view}>
      {block.floors.map((floor) => {
        const polygon = layout ? layout.get(floor.number) : floor.facadePolygon;
        if (!polygon) return null;
        const href = selectorHref(block.code, floor.number);
        const label = labels.floorName(floor.number, floor.apartments);
        const testId = `mertebe-${floor.number}`;
        const available = t("available", { count: statusCounts(floor.apartments).available });
        if (view) {
          // A band drawn across a facade: the floor's name in its middle,
          // swapped for what is available on hover and focus.
          const { x, y } = labelPoint(polygon, area);
          const { width, height } = boxSize(polygon, area);
          const fontSize = Math.round(Math.min(44, height * 0.45, width * 0.09));
          return (
            <Hotspot
              key={floor.number}
              href={href}
              label={label}
              polygon={polygon}
              size={area}
              testId={testId}
            >
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                className="kompleks-summary fill-text"
              >
                {labels.floor(floor.number)}
              </text>
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                className="kompleks-detail fill-text"
              >
                {available}
              </text>
            </Hotspot>
          );
        }
        const [[left] = [0, 0], [right] = [0, 0]] = polygon;
        const { y } = labelPoint(polygon, area);
        const { height } = boxSize(polygon, area);
        const size = Math.round(Math.min(44, height * 0.36));
        return (
          <Hotspot
            key={floor.number}
            href={href}
            label={label}
            polygon={polygon}
            size={area}
            testId={testId}
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
              {available}
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
  view,
  locale,
}: {
  block: SelectorBlock;
  floor: SelectorFloor;
  view: View;
  locale: Locale;
}) {
  const t = useTranslations("Complex");
  const labels = useLabels(locale);
  const card = useTranslations("Catalogue.card");
  const cells = view ? null : floorLayout(floor.apartments.length);
  const area = view?.canvas ?? canvas;
  return (
    <Plan
      label={t("figureApartments", {
        block: block.name.value,
        floor: formatNumber(floor.number, locale),
      })}
      view={view}
    >
      {floor.apartments.map((apartment, index) => {
        const polygon = cells ? cells[index] : apartment.planPolygon;
        if (!polygon) return null;
        const { x, y } = labelPoint(polygon, area);
        const size = fit(polygon, area, 72, 34);
        const line = size.small * 1.35;
        return (
          <Hotspot
            key={apartment.slug}
            href={{ pathname: "/menziller/[slug]", params: { slug: apartment.slug } }}
            label={`${labels.apartmentName(block, apartment)}: ${labels.specs(apartment)}, ${labels.status(apartment.status)}`}
            polygon={polygon}
            size={area}
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
    <li className="relative flex min-h-target flex-wrap items-center justify-between gap-x-u2 gap-y-1 border-b border-(--t-line) py-u">
      {children}
    </li>
  );
}

function BlocksList({ data, locale }: { data: ComplexSelectorData; locale: Locale }) {
  const labels = useLabels(locale);
  return (
    <ul className="border-t border-(--t-line)">
      {data.blocks.map((block) => (
        <Row key={block.code}>
          <Link href={selectorHref(block.code)} scroll={false} className={cx("text-body", rowLink)}>
            {block.name.value}
          </Link>
          <span className="text-small-t text-(--t-small)">
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
    <ul className="border-t border-(--t-line)">
      {[...block.floors].reverse().map((floor) => (
        <Row key={floor.number}>
          <Link
            href={selectorHref(block.code, floor.number)}
            scroll={false}
            className={cx("text-body", rowLink)}
          >
            {labels.floor(floor.number)}
          </Link>
          <span className="text-small-t text-(--t-small)">{labels.counts(floor.apartments)}</span>
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
    <ul className="border-t border-(--t-line)">
      {floor.apartments.map((apartment) => (
        <Row key={apartment.slug}>
          <span className="flex flex-col">
            <Link
              href={{ pathname: "/menziller/[slug]", params: { slug: apartment.slug } }}
              className={cx("text-body", rowLink)}
            >
              {labels.apartmentName(block, apartment)}
            </Link>
            <span className="text-small-t text-(--t-small)">{labels.specs(apartment)}</span>
          </span>
          <StatusBadge status={apartment.status} />
        </Row>
      ))}
    </ul>
  );
}
