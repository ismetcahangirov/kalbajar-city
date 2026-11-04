import { describe, expect, it } from "vitest";

import {
  boxSize,
  canvas,
  drawnView,
  facadeLayout,
  floorLayout,
  hasSelectionParams,
  labelPoint,
  pictureCanvas,
  resolveSelection,
  selectorPolygonSchema,
  selectionQuery,
  siteLayout,
  statusCounts,
  toSvgPoints,
  type ComplexSelectorData,
  type Polygon,
  type SelectorBlock,
} from "@/shared/complex";

const name = (value: string) => ({ value, locale: "az" as const, fallback: false });

function block(code: string, building: string, floors: number[]): SelectorBlock {
  return {
    code,
    name: name(`${code} blok`),
    building: { slug: building, name: name(building) },
    floors: floors.map((number) => ({
      number,
      apartments: [1, 2, 3].map((i) => ({
        slug: `blok-${code.toLowerCase()}-menzil-${number}0${i}`,
        number: `${number}0${i}`,
        status: i === 1 ? "available" : i === 2 ? "reserved" : "sold",
        rooms: i,
        areaTotal: "60.50",
        planPolygon: null,
      })),
      facadePolygon: null,
      plan: null,
    })),
    sitePolygon: null,
    facade: null,
  };
}

const data: ComplexSelectorData = {
  site: null,
  blocks: [
    block("A", "bina-1", [1, 2, 3]),
    block("B", "bina-1", [1, 2]),
    block("C", "bina-2", [1]),
  ],
};

const inside = (polygon: Polygon) =>
  polygon.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1);

function overlaps(a: Polygon, b: Polygon): boolean {
  const box = (p: Polygon) => ({
    x0: Math.min(...p.map(([x]) => x)),
    x1: Math.max(...p.map(([x]) => x)),
    y0: Math.min(...p.map(([, y]) => y)),
    y1: Math.max(...p.map(([, y]) => y)),
  });
  const p = box(a);
  const q = box(b);
  return p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
}

function expectDisjoint(polygons: Polygon[]) {
  for (let i = 0; i < polygons.length; i++)
    for (let j = i + 1; j < polygons.length; j++)
      expect(overlaps(polygons[i]!, polygons[j]!), `${i} overlaps ${j}`).toBe(false);
}

describe("complex selector selection", () => {
  it("resolves a block and a floor from the URL", () => {
    const selection = resolveSelection(data, { blok: "a", mertebe: "2" });
    expect(selection.block?.code).toBe("A");
    expect(selection.floor?.number).toBe(2);
  });

  it("drops what the inventory does not have", () => {
    expect(resolveSelection(data, { blok: "Z", mertebe: "1" })).toEqual({
      block: null,
      floor: null,
    });
    expect(resolveSelection(data, { blok: "B", mertebe: "9" }).floor).toBeNull();
    expect(resolveSelection(data, { blok: "B", mertebe: "abc" }).floor).toBeNull();
    expect(resolveSelection(data, { blok: "<script>" }).block).toBeNull();
    expect(resolveSelection(data, { mertebe: "1" }).block).toBeNull();
    expect(resolveSelection(data, { blok: ["C", "A"] }).block?.code).toBe("C");
  });

  it("writes the selection back as Azerbaijani query keys", () => {
    expect(selectionQuery()).toEqual({});
    expect(selectionQuery("A")).toEqual({ blok: "A" });
    expect(selectionQuery("A", 3)).toEqual({ blok: "A", mertebe: "3" });
    expect(selectionQuery("A", 0)).toEqual({ blok: "A", mertebe: "0" });
    expect(hasSelectionParams({})).toBe(false);
    expect(hasSelectionParams({ blok: "A" })).toBe(true);
  });

  it("counts apartments by status", () => {
    expect(statusCounts(data.blocks[0]!.floors[0]!.apartments)).toEqual({
      available: 1,
      reserved: 1,
      sold: 1,
      total: 3,
    });
  });
});

describe("complex selector geometry", () => {
  it("gives every block its own shape inside the picture", () => {
    const layout = siteLayout(data.blocks);
    expect([...layout.keys()]).toEqual(["A", "B", "C"]);
    const shapes = [...layout.values()];
    expect(shapes.every(inside)).toBe(true);
    expectDisjoint(shapes);
    // Blocks of one building share a row.
    expect(layout.get("A")![0]![1]).toBe(layout.get("B")![0]![1]);
  });

  it("lays out the demo set's 9 blocks in 6 buildings", () => {
    const codes = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    const per = [2, 2, 2, 1, 1, 1];
    let i = 0;
    const blocks = per.flatMap((count, b) =>
      Array.from({ length: count }, () => block(codes[i++]!, `bina-${b + 1}`, [1])),
    );
    const shapes = [...siteLayout(blocks).values()];
    expect(shapes).toHaveLength(9);
    expect(shapes.every(inside)).toBe(true);
    expectDisjoint(shapes);
  });

  it("stacks floors with the highest on top", () => {
    const layout = facadeLayout([1, 2, 3, 4]);
    const top = (n: number) => layout.get(n)![0]![1];
    expect(top(4)).toBeLessThan(top(3));
    expect(top(1)).toBeGreaterThan(top(2));
    expect([...layout.values()].every(inside)).toBe(true);
    expectDisjoint([...layout.values()]);
  });

  it("gives every apartment on a floor a cell, for any count", () => {
    for (const count of [0, 1, 2, 3, 4, 7, 12]) {
      const cells = floorLayout(count);
      expect(cells).toHaveLength(count);
      expect(cells.every(inside)).toBe(true);
      expectDisjoint(cells);
    }
  });

  it("converts normalised points to the canvas", () => {
    const square: Polygon = [
      [0, 0],
      [0.5, 0],
      [0.5, 0.5],
      [0, 0.5],
    ];
    expect(toSvgPoints(square)).toBe(
      `0,0 ${canvas.width / 2},0 ${canvas.width / 2},${canvas.height / 2} 0,${canvas.height / 2}`,
    );
    expect(labelPoint(square)).toEqual({ x: canvas.width / 4, y: canvas.height / 4 });
    expect(boxSize(square)).toEqual({ width: canvas.width / 2, height: canvas.height / 2 });
  });
});

describe("complex selector drawn hotspots", () => {
  const picture = { src: "/x.webp", width: 1600, height: 900, alt: "", illustrative: false };
  const triangle: Polygon = [
    [0.1, 0.1],
    [0.4, 0.1],
    [0.1, 0.4],
  ];

  it("stores polygons rounded, inside the picture and with an area", () => {
    expect(
      selectorPolygonSchema.parse([
        [0.123456, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toEqual([
      [0.1235, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(
      selectorPolygonSchema.safeParse([
        [0, 0],
        [1, 1],
      ]).success,
    ).toBe(false);
    expect(
      selectorPolygonSchema.safeParse([
        [0, 0],
        [1.2, 0],
        [1, 1],
      ]).success,
    ).toBe(false);
    // Three points on one line enclose nothing: a misclick, not a hotspot.
    expect(
      selectorPolygonSchema.safeParse([
        [0, 0],
        [0.5, 0.5],
        [1, 1],
      ]).success,
    ).toBe(false);
    expect(selectorPolygonSchema.safeParse(Array.from({ length: 65 }, () => [0, 0])).success).toBe(
      false,
    );
  });

  it("draws a level on its picture only when every hotspot is drawn", () => {
    expect(drawnView(null, [triangle])).toBeNull();
    expect(drawnView(picture, [])).toBeNull();
    expect(drawnView(picture, [triangle, null])).toBeNull();
    expect(drawnView(picture, [triangle])).toEqual({
      picture,
      canvas: { width: 1000, height: 563 },
      polygons: [triangle],
    });
    expect(pictureCanvas({ width: 600, height: 800 })).toEqual({ width: 1000, height: 1333 });
  });

  it("labels a shape at its centroid, on any canvas", () => {
    const size = { width: 1000, height: 500 };
    expect(labelPoint(triangle, size)).toEqual({ x: 200, y: 100 });
    // An L shape: the centroid stays in its body, not the empty corner.
    const l: Polygon = [
      [0, 0],
      [0.2, 0],
      [0.2, 0.8],
      [1, 0.8],
      [1, 1],
      [0, 1],
    ];
    const point = labelPoint(l, { width: 1, height: 1 });
    expect(point.x).toBeLessThan(0.5);
    expect(point.y).toBeGreaterThan(0.5);
    expect(toSvgPoints(triangle, size)).toBe("100,50 400,50 100,200");
  });
});
