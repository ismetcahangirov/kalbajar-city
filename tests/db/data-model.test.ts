import { count, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as s from "@/db/schema";
import { seed } from "@/db/seed";
import { paragraphs } from "@/shared/rich-text";

import { inRollback, violates, type Tx } from "./helpers";

const name = { az: "Ad" };

async function fixtureInventory(tx: Tx) {
  const [building] = await tx.insert(s.buildings).values({ slug: "bina-x", name }).returning();
  const [block] = await tx
    .insert(s.blocks)
    .values({ slug: "blok-x", code: "X", name, buildingId: building!.id })
    .returning();
  const [floor] = await tx.insert(s.floors).values({ blockId: block!.id, number: 1 }).returning();
  const [layout] = await tx
    .insert(s.layoutTypes)
    .values({ slug: "plan-x", code: "X-1", rooms: 2, areaTotal: "74.40" })
    .returning();
  const apartment = {
    slug: "menzil-x-101",
    number: "101",
    floorId: floor!.id,
    layoutTypeId: layout!.id,
    areaTotal: "74.40",
  };
  return { building: building!, block: block!, floor: floor!, layout: layout!, apartment };
}

async function rows(tx: Tx, table: PgTable) {
  const [row] = await tx.select({ n: count() }).from(table);
  return row?.n;
}

describe("seed", () => {
  it("loads the known facts and the demo inventory, then changes nothing on a re-run", async () => {
    await inRollback(async (tx) => {
      const first = await seed(tx);
      expect(first).toMatchObject({
        settings: 6,
        layoutTypes: 10,
        homeSections: 11,
        faq: 6,
        buildings: 6,
        blocks: 9,
        floors: 36,
        apartments: 143,
      });

      const second = await seed(tx);
      expect(Object.values(second).every((v) => v === 0 || v === "skipped")).toBe(true);
      expect(await rows(tx, s.apartments)).toBe(143);
      expect(await rows(tx, s.faq)).toBe(6);
    });
  });

  it("keeps console edits on a re-run", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      await tx
        .update(s.settings)
        .set({ value: { visible: true } })
        .where(eq(s.settings.key, "prices"));
      await seed(tx);
      const [prices] = await tx.select().from(s.settings).where(eq(s.settings.key, "prices"));
      expect(prices?.value).toEqual({ visible: true });
    });
  });

  it("skips the demo inventory once a real apartment exists", async () => {
    await inRollback(async (tx) => {
      const { apartment } = await fixtureInventory(tx);
      await tx.insert(s.apartments).values(apartment);
      const report = await seed(tx);
      expect(report.demoInventory).toBe("skipped");
      expect(await rows(tx, s.apartments)).toBe(1);
    });
  });
});

describe("constraints", () => {
  it("guards apartments: unique slug and number, status, price, currency, area", async () => {
    await inRollback(async (tx) => {
      const { apartment } = await fixtureInventory(tx);
      await tx.insert(s.apartments).values(apartment);

      await violates(tx, "apartments_slug_unique", (sp) =>
        sp.insert(s.apartments).values({ ...apartment, number: "102" }),
      );
      await violates(tx, "apartments_floor_number", (sp) =>
        sp.insert(s.apartments).values({ ...apartment, slug: "other" }),
      );
      const fresh = { ...apartment, slug: "a2", number: "102" };
      await violates(tx, "apartments_price_non_negative", (sp) =>
        sp.insert(s.apartments).values({ ...fresh, priceMinor: -1 }),
      );
      await violates(tx, "apartments_currency_code", (sp) =>
        sp.insert(s.apartments).values({ ...fresh, currency: "azn" }),
      );
      await violates(tx, "apartments_area_positive", (sp) =>
        sp.insert(s.apartments).values({ ...fresh, areaTotal: "0" }),
      );
      await violates(tx, "invalid_enum_value", (sp) =>
        sp.insert(s.apartments).values({ ...fresh, status: "rented" as "sold" }),
      );

      const [stored] = await tx
        .insert(s.apartments)
        .values({ ...fresh, priceMinor: 18_500_000_00 })
        .returning();
      expect(stored).toMatchObject({
        priceMinor: 18_500_000_00,
        currency: "AZN",
        status: "available",
      });
      expect(stored?.areaTotal).toBe("74.40");
    });
  });

  it("refuses to delete inventory that apartments still use", async () => {
    await inRollback(async (tx) => {
      const { apartment, layout } = await fixtureInventory(tx);
      await tx.insert(s.apartments).values(apartment);
      await violates(tx, "apartments_layout_type_id_layout_types_id_fk", (sp) =>
        sp.delete(s.layoutTypes).where(eq(s.layoutTypes.id, layout.id)),
      );
    });
  });

  it("refuses to delete media that is still in use", async () => {
    await inRollback(async (tx) => {
      const [file] = await tx
        .insert(s.media)
        .values({ key: "a.jpg", kind: "image", mimeType: "image/jpeg", size: 10 })
        .returning();
      await tx.insert(s.mediaUsages).values({
        mediaId: file!.id,
        entityType: "news",
        entityId: crypto.randomUUID(),
        field: "cover",
      });
      await violates(tx, "media_usages_media_id_media_id_fk", (sp) =>
        sp.delete(s.media).where(eq(s.media.id, file!.id)),
      );
      await violates(tx, "media_focus_range", (sp) =>
        sp
          .insert(s.media)
          .values({ key: "b.jpg", kind: "image", mimeType: "image/jpeg", size: 1, focusX: 2 }),
      );
    });
  });

  it("needs a publication date on published content and whole months on updates", async () => {
    await inRollback(async (tx) => {
      const body = { az: paragraphs("Mətn") };
      await violates(tx, "news_published_has_date", (sp) =>
        sp.insert(s.news).values({ slug: "x", title: name, body, status: "published" }),
      );
      await violates(tx, "construction_updates_first_of_month", (sp) =>
        sp
          .insert(s.constructionUpdates)
          .values({ slug: "x", month: "2026-10-15", title: name, progressPercent: 40 }),
      );
      await violates(tx, "construction_updates_progress_range", (sp) =>
        sp
          .insert(s.constructionUpdates)
          .values({ slug: "x", month: "2026-10-01", title: name, progressPercent: 101 }),
      );
    });
  });

  it("guards leads, redirects and SEO paths", async () => {
    await inRollback(async (tx) => {
      const lead = {
        type: "inquiry" as const,
        name: "Ad",
        phone: "+994501234567",
        sourcePath: "/",
      };
      await violates(tx, "leads_locale", (sp) =>
        sp.insert(s.leads).values({ ...lead, locale: "de" }),
      );
      const [stored] = await tx
        .insert(s.leads)
        .values({ ...lead, locale: "az" })
        .returning();
      expect(stored?.status).toBe("new");

      await violates(tx, "redirects_not_self", (sp) =>
        sp.insert(s.redirects).values({ fromPath: "/a", toPath: "/a" }),
      );
      await violates(tx, "redirects_status_code", (sp) =>
        sp.insert(s.redirects).values({ fromPath: "/a", toPath: "/b", statusCode: 200 }),
      );
      await violates(tx, "seo_overrides_path", (sp) =>
        sp.insert(s.seoOverrides).values({ path: "menziller" }),
      );
    });
  });

  it("deletes a lead's notes and events with it, and keeps the lead when its apartment goes", async () => {
    await inRollback(async (tx) => {
      const { apartment } = await fixtureInventory(tx);
      const [flat] = await tx.insert(s.apartments).values(apartment).returning();
      const [lead] = await tx
        .insert(s.leads)
        .values({
          type: "viewing",
          name: "Ad",
          phone: "+994501234567",
          locale: "en",
          sourcePath: "/en/menziller/menzil-x-101",
          apartmentId: flat!.id,
        })
        .returning();
      await tx.insert(s.leadNotes).values({ leadId: lead!.id, body: "Zəng edildi" });
      await tx.insert(s.leadEvents).values({ leadId: lead!.id, type: "created" });

      await tx.delete(s.apartments).where(eq(s.apartments.id, flat!.id));
      const [orphan] = await tx.select().from(s.leads).where(eq(s.leads.id, lead!.id));
      expect(orphan?.apartmentId).toBeNull();

      await tx.delete(s.leads).where(eq(s.leads.id, lead!.id));
      expect(await rows(tx, s.leadNotes)).toBe(0);
      expect(await rows(tx, s.leadEvents)).toBe(0);
    });
  });

  it("numbers the audit log and keeps the before and after state", async () => {
    await inRollback(async (tx) => {
      const [entry] = await tx
        .insert(s.auditLog)
        .values({
          action: "apartment.update",
          entityType: "apartments",
          entityId: "x",
          before: { status: "available" },
          after: { status: "reserved" },
        })
        .returning();
      expect(typeof entry?.id).toBe("number");
      expect(entry?.after).toEqual({ status: "reserved" });
    });
  });
});
