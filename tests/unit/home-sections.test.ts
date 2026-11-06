import { describe, expect, it, vi } from "vitest";

import * as seed from "@/db/seed/data";
import {
  featuredRoomsToForm,
  layoutsFormSchema,
  layoutsToForm,
} from "@/lib/admin/home-section-forms";
import { locationFormSchema, locationToForm } from "@/lib/admin/settings-forms";
import { resolveHomeSections, type HomeSectionRow } from "@/lib/public/home-sections";
import { featuredGroups, type LayoutGroup } from "@/lib/public/layouts";
import {
  homeSectionContentSchemas,
  homeSectionKeys,
  homeSectionMedia,
  homeSectionOrderSchema,
} from "@/shared/home-sections";

const row = (key: HomeSectionRow["key"], sortOrder: number, visible = true): HomeSectionRow => ({
  key,
  sortOrder,
  visible,
  content: seed.homeSections[key],
});

const keys = (rows: ReadonlyArray<{ key: string }>) => rows.map(({ key }) => key);

describe("resolveHomeSections", () => {
  it("shows every section in the default order with nothing saved", () => {
    const sections = resolveHomeSections([]);
    expect(keys(sections)).toEqual([...homeSectionKeys]);
    expect(sections.every((section) => section.visible)).toBe(true);
    expect(sections[0]?.content).toEqual(seed.homeSections.hero);
  });

  it("follows the saved order and visibility", () => {
    const sections = resolveHomeSections(
      homeSectionKeys.map((key, i) => row(key, homeSectionKeys.length - i, key !== "faq")),
    );
    expect(keys(sections)).toEqual(["hero", ...[...homeSectionKeys].slice(1).reverse()]);
    expect(sections.find((section) => section.key === "faq")?.visible).toBe(false);
  });

  it("keeps the hero first and shown, whatever the row says", () => {
    const [first] = resolveHomeSections([row("stats", 0), row("hero", 5, false)]);
    expect(first).toMatchObject({ key: "hero", visible: true });
  });

  it("puts a section without a row in its default place", () => {
    const sections = resolveHomeSections([row("cta", 0), row("stats", 3)]);
    expect(keys(sections).slice(0, 3)).toEqual(["hero", "cta", "about"]);
  });

  it("shows the defaults for content that no longer matches its schema", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const sections = resolveHomeSections([{ ...row("about", 2), content: { title: 1 } }]);
    expect(sections.find((section) => section.key === "about")?.content).toEqual(
      seed.homeSections.about,
    );
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});

describe("homeSectionOrderSchema", () => {
  const list = homeSectionKeys.map((key) => ({ key, visible: true }));

  it("accepts any order of the other sections", () => {
    const [hero, ...rest] = list;
    expect(homeSectionOrderSchema.safeParse({ sections: [hero, ...rest.reverse()] }).success).toBe(
      true,
    );
  });

  it("refuses a list that moves or hides the hero, repeats or misses a section", () => {
    const refused = [
      [...list].reverse(),
      [{ key: "hero", visible: false }, ...list.slice(1)],
      [...list.slice(0, -1), list[1]],
      list.slice(0, -1),
    ];
    for (const sections of refused) {
      expect(homeSectionOrderSchema.safeParse({ sections }).success).toBe(false);
    }
  });
});

describe("featured layouts", () => {
  const groups = [1, 2, 3].map((rooms): LayoutGroup => ({
    rooms,
    areaMin: 1,
    areaMax: 2,
    plans: 1,
    image: null,
  }));
  const rooms = (list: readonly LayoutGroup[]) => list.map((group) => group.rooms);

  it("shows every group while nothing is chosen", () => {
    expect(rooms(featuredGroups(groups, null))).toEqual([1, 2, 3]);
    expect(rooms(featuredGroups(groups, undefined))).toEqual([1, 2, 3]);
  });

  it("shows the chosen groups in the chosen order, skipping a room count that has gone", () => {
    expect(rooms(featuredGroups(groups, [3, 9, 1]))).toEqual([3, 1]);
  });

  it("falls back to every group when none of the chosen ones is left", () => {
    expect(rooms(featuredGroups(groups, [9]))).toEqual([1, 2, 3]);
  });

  it("lists the chosen room counts first, then the rest, off", () => {
    expect(featuredRoomsToForm([3, 1], [1, 2, 3])).toEqual([
      { rooms: 3, shown: true },
      { rooms: 1, shown: true },
      { rooms: 2, shown: false },
    ]);
    expect(featuredRoomsToForm(null, [1, 2])).toEqual([
      { rooms: 1, shown: true },
      { rooms: 2, shown: true },
    ]);
  });

  const parse = (featuredRooms: Array<{ rooms: number; shown: boolean }>) =>
    layoutsFormSchema.safeParse({
      ...layoutsToForm(seed.homeSections.layouts, []),
      featuredRooms,
    });

  it("saves all room counts in the default order as no choice", () => {
    const { data } = parse([
      { rooms: 1, shown: true },
      { rooms: 2, shown: true },
    ]);
    expect(data?.featuredRooms).toBeNull();
  });

  it("saves a choice in its order, which the section's schema accepts", () => {
    const { data } = parse([
      { rooms: 3, shown: true },
      { rooms: 1, shown: true },
      { rooms: 2, shown: false },
    ]);
    expect(data?.featuredRooms).toEqual([3, 1]);
    expect(homeSectionContentSchemas.layouts.safeParse(data).success).toBe(true);
  });

  it("refuses to save with every room count off", () => {
    expect(parse([{ rooms: 1, shown: false }]).success).toBe(false);
  });
});

describe("homeSectionMedia", () => {
  const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

  it("separates the hero's images from its video", () => {
    expect(
      homeSectionMedia({
        key: "hero",
        content: {
          title: { az: "x" },
          posterMediaId: id(1),
          panelMediaId: id(2),
          videoMediaId: id(3),
        },
      }),
    ).toEqual({ images: [id(1), id(2)], videos: [id(3)] });
  });

  it("names every image of the location section", () => {
    const { images } = homeSectionMedia({
      key: "location",
      content: {
        ...seed.homeSections.location,
        mapMediaId: id(1),
        introMediaId: id(2),
        moverLeftMediaId: id(3),
        moverRightMediaId: id(4),
        cardMediaIds: [id(5)],
      },
    });
    expect(images).toEqual([id(1), id(2), id(3), id(4), id(5)]);
  });
});

describe("the location form", () => {
  it("keeps the section's images through a save", () => {
    const content = homeSectionContentSchemas.location.parse({
      ...seed.homeSections.location,
      introMediaId: "00000000-0000-4000-8000-000000000001",
      cardMediaIds: ["00000000-0000-4000-8000-000000000002"],
    });
    const { data } = locationFormSchema.safeParse(locationToForm(content));
    expect(data).toMatchObject({
      introMediaId: content.introMediaId,
      cardMediaIds: content.cardMediaIds,
    });
  });
});
