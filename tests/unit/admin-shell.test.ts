import { describe, expect, it } from "vitest";

import { adminArea, adminDateTime, adminMoney, adminNumber } from "@/lib/admin/format";
import { buildMenu, canOpen } from "@/lib/admin/menu";
import { adminModules, breadcrumbsFor, isCurrent, moduleOf } from "@/lib/admin/navigation";
import { translatablesIn, missingLocales } from "@/lib/admin/translatables";
import { weekStart } from "@/lib/admin/week";
import { userRoles } from "@/lib/auth/permissions";

const hrefs = (role: (typeof userRoles)[number]) =>
  buildMenu(role).flatMap((group) => group.items.map((item) => item.href));

describe("the role-aware menu", () => {
  it("gives owners and admins every module", () => {
    const all = Object.values(adminModules).map((module) => module.href);
    expect(hrefs("owner").sort()).toEqual([...all].sort());
    expect(hrefs("admin")).toEqual(hrefs("owner"));
  });

  it("gives sales the dashboard, apartments and leads only", () => {
    expect(hrefs("sales")).toEqual(["/admin", "/admin/menziller", "/admin/muracietler"]);
    expect(buildMenu("sales").map((group) => group.label)).toEqual([null, "Satış"]);
  });

  it("gives editors the dashboard and the content modules only", () => {
    expect(hrefs("editor")).toEqual(["/admin", "/admin/xeberler", "/admin/media"]);
  });

  it("never lists a module the role may not open, and leaves out empty groups", () => {
    for (const role of userRoles) {
      for (const group of buildMenu(role)) {
        expect(group.items.length).toBeGreaterThan(0);
        for (const item of group.items) expect(canOpen(role, item.module)).toBe(true);
      }
    }
  });

  it("uses Azerbaijani routes and labels", () => {
    for (const { href } of Object.values(adminModules))
      expect(href).toMatch(/^\/admin(\/[a-z]+)?$/);
    expect(buildMenu("owner")[0]?.items[0]).toEqual({
      module: "dashboard",
      href: "/admin",
      label: "İcmal",
    });
  });
});

describe("navigation state", () => {
  it("marks the dashboard current only on /admin, a module on its whole subtree", () => {
    expect(isCurrent("/admin", "/admin")).toBe(true);
    expect(isCurrent("/admin/menziller", "/admin")).toBe(false);
    expect(isCurrent("/admin/menziller/abc", "/admin/menziller")).toBe(true);
    expect(isCurrent("/admin/menziller-x", "/admin/menziller")).toBe(false);
  });

  it("finds the module of a path", () => {
    expect(moduleOf("/admin")).toBe("dashboard");
    expect(moduleOf("/admin/audit")).toBe("audit");
    expect(moduleOf("/admin/media/123")).toBe("media");
    expect(moduleOf("/admin/unknown")).toBeNull();
  });

  it("builds breadcrumbs whose last crumb is the current page", () => {
    expect(breadcrumbsFor("/admin")).toEqual([{ label: "İcmal" }]);
    expect(breadcrumbsFor("/admin/menziller")).toEqual([
      { label: "İcmal", href: "/admin" },
      { label: "Mənzillər" },
    ]);
    expect(breadcrumbsFor("/admin/menziller/abc").at(-1)).toEqual({
      label: "Mənzillər",
      href: "/admin/menziller",
    });
  });
});

describe("the dashboard's helpers", () => {
  it("starts the week on Monday 00:00 in Baku (UTC+4)", () => {
    // Monday 2 November 2026, 03:00 in Baku is still Sunday in UTC.
    expect(weekStart(new Date("2026-11-01T23:00:00Z")).toISOString()).toBe(
      "2026-11-01T20:00:00.000Z",
    );
    // Sunday 1 November 2026, 23:59 in Baku belongs to the week before.
    expect(weekStart(new Date("2026-11-01T19:59:00Z")).toISOString()).toBe(
      "2026-10-25T20:00:00.000Z",
    );
    expect(weekStart(new Date("2026-11-04T12:00:00Z")).toISOString()).toBe(
      "2026-11-01T20:00:00.000Z",
    );
  });

  it("finds plain and rich translatable values anywhere in stored JSON", () => {
    const doc = (text: string) => ({
      type: "doc",
      content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
    });
    const found = translatablesIn({
      title: { az: "Başlıq", en: "Title", ru: null },
      items: [{ caption: { az: "Şəkil" } }, { minutes: 5 }],
      body: { az: doc("Mətn"), en: doc(""), ru: doc("Текст") },
      unrelated: { az: 1 },
    });
    expect(found).toEqual([
      { az: "Başlıq", en: "Title", ru: "" },
      { az: "Şəkil", en: "", ru: "" },
      { az: "·", en: "", ru: "·" },
    ]);
  });

  it("lists the languages a translatable value lacks", () => {
    expect(missingLocales({ az: "Salam", en: "Hello", ru: " " })).toEqual(["ru"]);
    expect(missingLocales(undefined)).toEqual(["az", "en", "ru"]);
  });
});

describe("console formatting", () => {
  it("formats numbers, areas and prices by the az rules without the browser's locale data", () => {
    expect(adminNumber(22634.5)).toBe("22 634,5");
    expect(adminArea("62.09")).toBe("62,09 m²");
    expect(adminArea("74.40")).toBe("74,4 m²");
    expect(adminMoney("12500000", "AZN")).toBe("125 000 AZN");
    expect(adminMoney("9999950", "AZN")).toBe("99 999,50 AZN");
  });

  it("shows times on the Baku clock", () => {
    expect(adminDateTime("2026-11-02T10:05:00.000Z")).toBe("02.11.2026, 14:05");
    expect(adminDateTime(new Date("2026-12-31T21:30:00Z"))).toBe("01.01.2027, 01:30");
  });
});
