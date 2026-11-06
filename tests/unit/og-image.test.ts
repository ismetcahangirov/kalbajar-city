import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Rendering a PNG needs Satori's WebAssembly; what matters here is what reaches it.
const rendered = vi.hoisted(() => [] as Array<{ element: unknown; options: unknown }>);
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(element: unknown, options: unknown) {
      rendered.push({ element, options });
    }
  },
}));

const { ogImage } = await import("@/lib/seo/og");

type Font = { name: string; data: Buffer; weight: number; style: string };

const fontFile = (name: string) =>
  readFileSync(join(process.cwd(), "src/fonts/alethia-next/og", name));

describe("Open Graph cards (#28)", () => {
  it("are set in Alethia Next, from its OpenType files", async () => {
    await ogImage({ eyebrow: "Kalbajar City", title: "Mənzillər", details: ["2 otaq"] });
    const [card] = rendered;
    const { fonts, width, height } = card!.options as {
      fonts: Font[];
      width: number;
      height: number;
    };
    expect({ width, height }).toEqual({ width: 1200, height: 630 });
    expect(fonts.map(({ name, weight, style }) => ({ name, weight, style }))).toEqual([
      { name: "Alethia Next", weight: 400, style: "normal" },
      { name: "Alethia Next", weight: 500, style: "normal" },
    ]);
    // The files themselves, not an empty or substituted buffer: OpenType (CFF) starts with "OTTO".
    expect(fonts[0]!.data.equals(fontFile("AlethiaNext-Regular.otf"))).toBe(true);
    expect(fonts[1]!.data.equals(fontFile("AlethiaNext-Medium.otf"))).toBe(true);
    for (const font of fonts) expect(font.data.subarray(0, 4).toString("latin1")).toBe("OTTO");

    const root = card!.element as { props: { style: { fontFamily: string } } };
    expect(root.props.style.fontFamily).toBe("Alethia Next");
  });
});
