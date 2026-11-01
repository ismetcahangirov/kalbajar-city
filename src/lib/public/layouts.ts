import type { PublicImage } from "./media";

export type LayoutGroup = {
  rooms: number;
  areaMin: number;
  areaMax: number;
  plans: number;
  image: PublicImage | null;
};

/** One card per room count, with the area range of its plans. */
export function groupLayouts(
  layouts: Array<{ rooms: number; areaTotal: string; planMediaId: string | null }>,
  image: (id: string | null) => PublicImage | null,
): LayoutGroup[] {
  const groups = new Map<number, LayoutGroup>();
  for (const layout of layouts) {
    const area = Number(layout.areaTotal);
    const group = groups.get(layout.rooms);
    if (!group) {
      groups.set(layout.rooms, {
        rooms: layout.rooms,
        areaMin: area,
        areaMax: area,
        plans: 1,
        image: image(layout.planMediaId),
      });
      continue;
    }
    group.areaMin = Math.min(group.areaMin, area);
    group.areaMax = Math.max(group.areaMax, area);
    group.plans += 1;
    group.image ??= image(layout.planMediaId);
  }
  return [...groups.values()].sort((a, b) => a.rooms - b.rooms);
}
