import { describe, expect, it } from "vitest";

import * as s from "@/db/schema";
import {
  apartmentsByStatus,
  leadsThisWeek,
  missingTranslationCount,
  recentActivity,
} from "@/lib/admin/dashboard";

import { inRollback } from "./helpers";

const lead = {
  name: "Test Lead",
  phone: "+994501234567",
  locale: "az",
  sourcePath: "/elaqe",
} as const;

describe("the console dashboard", () => {
  it("counts this week's leads by type and status, from Monday in Baku", async () => {
    await inRollback(async (tx) => {
      // Wednesday 4 November 2026; the week began Sunday 1 November 20:00 UTC.
      const now = new Date("2026-11-04T12:00:00Z");
      await tx.insert(s.leads).values([
        { ...lead, type: "callback", createdAt: new Date("2026-11-01T20:00:00Z") },
        { ...lead, type: "callback", status: "contacted", createdAt: now },
        { ...lead, type: "viewing", createdAt: now },
        { ...lead, type: "inquiry", createdAt: new Date("2026-11-01T19:59:59Z") },
      ]);
      const week = await leadsThisWeek(tx, now);
      expect(week.since.toISOString()).toBe("2026-11-01T20:00:00.000Z");
      expect(week.total).toBe(3);
      expect(week.byType).toEqual({ inquiry: 0, viewing: 1, callback: 2 });
      expect(week.byStatus).toEqual({
        new: 2,
        contacted: 1,
        viewing: 0,
        reserved: 0,
        closed: 0,
        lost: 0,
      });
    });
  });

  it("counts apartments by status, every status present", async () => {
    await inRollback(async (tx) => {
      const name = { az: "Ad" };
      const [building] = await tx.insert(s.buildings).values({ slug: "bina-d", name }).returning();
      const [block] = await tx
        .insert(s.blocks)
        .values({ slug: "blok-d", code: "D9", name, buildingId: building!.id })
        .returning();
      const [floor] = await tx
        .insert(s.floors)
        .values({ blockId: block!.id, number: 1 })
        .returning();
      const [layout] = await tx
        .insert(s.layoutTypes)
        .values({ slug: "plan-d", code: "D-1", rooms: 2, areaTotal: "70.00" })
        .returning();
      const apartment = (number: string, status: "available" | "sold") => ({
        slug: `menzil-d-${number}`,
        number,
        status,
        floorId: floor!.id,
        layoutTypeId: layout!.id,
        areaTotal: "70.00",
      });
      await tx
        .insert(s.apartments)
        .values([apartment("1", "available"), apartment("2", "sold"), apartment("3", "sold")]);
      expect(await apartmentsByStatus(tx)).toEqual({
        total: 3,
        byStatus: { available: 1, reserved: 0, sold: 2, not_for_sale: 0 },
      });
    });
  });

  it("counts missing translations in columns and inside JSON values", async () => {
    await inRollback(async (tx) => {
      await tx.insert(s.faq).values({
        question: { az: "Sual?", en: "Question?", ru: "" },
        answer: { az: "Cavab." },
      });
      await tx.insert(s.settings).values({
        key: "test.dashboard",
        value: { address: { az: "Ünvan", en: "Address", ru: "Адрес" }, note: { az: "Qeyd" } },
      });
      expect(await missingTranslationCount(tx)).toEqual({
        // ru of the question; en and ru of the answer; en and ru of the note.
        total: 5,
        byLocale: { az: 0, en: 2, ru: 3 },
      });
    });
  });

  it("lists the newest audit entries with the actor's name", async () => {
    await inRollback(async (tx) => {
      const [user] = await tx
        .insert(s.users)
        .values({ id: "dash-user", name: "Nigar", email: "dash@test.kalbajarcity.com" })
        .returning();
      await tx.insert(s.auditLog).values([
        {
          actorId: null,
          action: "user.create",
          entityType: "user",
          createdAt: new Date("2100-01-01T00:00:00Z"),
        },
        {
          actorId: user!.id,
          action: "apartment.update",
          entityType: "apartment",
          createdAt: new Date("2100-01-02T00:00:00Z"),
        },
      ]);
      // Dated ahead, so rows other tests left behind are older.
      const [newest, older] = await recentActivity(tx, 2);
      expect(newest).toMatchObject({ actor: "Nigar", action: "apartment.update" });
      expect(older).toMatchObject({ actor: null, action: "user.create" });
    });
  });
});
