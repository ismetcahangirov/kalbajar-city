import { describe, expect, it } from "vitest";

import { contacts, whatsappHref } from "@/config/contacts";
import az from "@/i18n/messages/az.json";
import ru from "@/i18n/messages/ru.json";
import { mapAppLinks, osmEmbedUrl } from "@/lib/maps";

describe("whatsappHref", () => {
  it("opens a chat with the number's digits", () => {
    expect(whatsappHref("+994505535555")).toBe("https://wa.me/994505535555");
    expect(whatsappHref("+994 50 553 55 55")).toBe("https://wa.me/994505535555");
  });

  it("types in the message, encoded", () => {
    const href = whatsappHref(contacts.whatsapp, az.Shell.whatsappMessage);
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe("https://wa.me/994505535555");
    expect(url.searchParams.get("text")).toBe(az.Shell.whatsappMessage);
    expect(href).not.toMatch(/\s/);
  });

  it("keeps Cyrillic and punctuation intact", () => {
    const href = whatsappHref("+994505535555", ru.Shell.whatsappMessage);
    expect(href).toContain("?text=%D0%97");
    expect(new URL(href).searchParams.get("text")).toBe(ru.Shell.whatsappMessage);
    expect(whatsappHref("+994505535555", "A & B?")).toBe(
      "https://wa.me/994505535555?text=A%20%26%20B%3F",
    );
  });

  it("leaves out an empty message", () => {
    expect(whatsappHref("+994505535555", "  ")).toBe("https://wa.me/994505535555");
  });
});

describe("map links", () => {
  const point = { lat: 40.1017, lng: 46.0381 };

  it("embeds OpenStreetMap around the point with a marker", () => {
    const url = new URL(osmEmbedUrl(point));
    expect(url.origin).toBe("https://www.openstreetmap.org");
    expect(url.pathname).toBe("/export/embed.html");
    expect(url.searchParams.get("marker")).toBe("40.1017,46.0381");
    const [minLng, minLat, maxLng, maxLat] = url.searchParams.get("bbox")!.split(",").map(Number);
    expect(minLng).toBeLessThan(point.lng);
    expect(maxLng).toBeGreaterThan(point.lng);
    expect(minLat).toBeLessThan(point.lat);
    expect(maxLat).toBeGreaterThan(point.lat);
  });

  it("opens the point in Google Maps, Apple Maps and Waze", () => {
    const links = mapAppLinks(point, "Kalbajar City");
    expect(new URL(links.google).searchParams.get("query")).toBe("40.1017,46.0381");
    expect(new URL(links.apple).searchParams.get("ll")).toBe("40.1017,46.0381");
    expect(new URL(links.apple).searchParams.get("q")).toBe("Kalbajar City");
    expect(new URL(links.waze).searchParams.get("ll")).toBe("40.1017,46.0381");
    expect(new URL(links.waze).searchParams.get("navigate")).toBe("yes");
  });
});
