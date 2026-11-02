import { useTranslations } from "next-intl";

import { formatArea, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { RoomArea, RoomKind } from "@/shared/inventory";

/**
 * Names the rooms of a breakdown; a kind that occurs more than once is
 * numbered in order (`Yataq otağı 1`, `Yataq otağı 2`).
 */
export function roomLabels(
  rooms: RoomArea[],
  name: (kind: RoomKind) => string,
  numbered: (name: string, number: number) => string,
): string[] {
  const totals = new Map<RoomKind, number>();
  for (const room of rooms) totals.set(room.kind, (totals.get(room.kind) ?? 0) + 1);
  const seen = new Map<RoomKind, number>();
  return rooms.map((room) => {
    const index = (seen.get(room.kind) ?? 0) + 1;
    seen.set(room.kind, index);
    return (totals.get(room.kind) ?? 0) > 1 ? numbered(name(room.kind), index) : name(room.kind);
  });
}

/** The area of each room as published on the plan, and the total. */
export function AreaTable({
  id,
  rooms,
  total,
  locale,
}: {
  /** The id of the heading that labels the table. */
  id: string;
  rooms: RoomArea[];
  total: string;
  locale: Locale;
}) {
  const t = useTranslations("ApartmentPage");
  const kinds = useTranslations("RoomKinds");
  const labels = roomLabels(
    rooms,
    (kind) => kinds(kind),
    (name, number) => kinds("numbered", { name, number: formatNumber(number, locale) }),
  );
  const cell = "border-b border-border py-3";
  return (
    <table aria-labelledby={id} className="w-full max-w-(--container-prose) text-body">
      <thead className="sr-only">
        <tr>
          <th scope="col">{t("room")}</th>
          <th scope="col">{t("roomArea")}</th>
        </tr>
      </thead>
      <tbody>
        {rooms.map((room, i) => (
          <tr key={`${room.kind}-${i}`}>
            <th scope="row" className={`${cell} pe-4 text-start font-normal`}>
              {labels[i]}
            </th>
            <td className={`${cell} text-end whitespace-nowrap`}>
              {formatArea(Number(room.area), locale)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className="pe-4 pt-4 text-start font-medium">
            {t("total")}
          </th>
          <td className="pt-4 text-end font-medium whitespace-nowrap">
            {formatArea(Number(total), locale)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
