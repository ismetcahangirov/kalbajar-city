import { afterEach, describe, expect, it, vi } from "vitest";

import { gtagInit, pixelInit } from "@/components/analytics/analytics-scripts";
import { track } from "@/lib/analytics";
import { llmsTxt, type LlmsDocument } from "@/lib/llms";
import { answerCrawlers, robotsRules } from "@/lib/seo/robots";
import { analyticsOrigins, contentSecurityPolicy } from "@/lib/security/csp";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/public/site", () => ({ getAnalyticsIds: async () => ({}) }));

const doc: LlmsDocument = {
  title: "Kalbajar City",
  summary: "The first private residential complex in Kalbajar. Kalbajar, Azerbaijan.",
  intro: "Kalbajar City is the first private residential complex in Kalbajar.",
  facts: {
    heading: "Key facts",
    sentences: ["Kalbajar City has 143\u00a0apartments.", "It stands on 1.13\u00a0ha."],
  },
  contacts: { heading: "Contacts", lines: [{ label: "Phone", value: "+994 12 434 32 32" }] },
  pages: {
    heading: "Pages",
    links: [
      { title: "Apartments", url: "https://x.az/en/menziller", description: "Choose a home." },
    ],
  },
  faq: { heading: "Frequently asked questions", items: [] },
  languages: {
    heading: "Other languages",
    links: [{ title: "Azərbaycanca", url: "https://x.az/llms-az.txt" }],
  },
};

describe("llms.txt", () => {
  it("lays the document out as llmstxt.org Markdown", () => {
    expect(llmsTxt(doc)).toBe(
      [
        "# Kalbajar City",
        "",
        "> The first private residential complex in Kalbajar. Kalbajar, Azerbaijan.",
        "",
        "Kalbajar City is the first private residential complex in Kalbajar.",
        "",
        "## Key facts",
        "",
        "- Kalbajar City has 143 apartments.",
        "- It stands on 1.13 ha.",
        "",
        "## Contacts",
        "",
        "- Phone: +994 12 434 32 32",
        "",
        "## Pages",
        "",
        "- [Apartments](https://x.az/en/menziller): Choose a home.",
        "",
        "## Other languages",
        "",
        "- [Azərbaycanca](https://x.az/llms-az.txt)",
        "",
      ].join("\n"),
    );
  });

  it("lists FAQ entries under their questions and keeps list items on one line", () => {
    const text = llmsTxt({
      ...doc,
      facts: { heading: "Key facts", sentences: ["One\nfact."] },
      faq: {
        heading: "Frequently asked questions",
        items: [{ question: "When is it\nfinished?", answer: "In 2027." }],
      },
    });
    expect(text).toContain("- One fact.");
    expect(text).toContain(
      "## Frequently asked questions\n\n### When is it finished?\n\nIn 2027.\n",
    );
    expect(text).not.toContain("\u00a0");
  });
});

describe("robots.txt", () => {
  it("names the search and AI answer crawlers, and keeps every one out of the console and API", () => {
    const rules = robotsRules();
    expect(Array.isArray(rules)).toBe(true);
    const list = rules as Array<{
      userAgent: string | string[];
      allow: string;
      disallow: string[];
    }>;
    expect(list.at(-1)?.userAgent).toBe("*");
    for (const bot of [
      "Googlebot",
      "Bingbot",
      "OAI-SearchBot",
      "PerplexityBot",
      "Claude-SearchBot",
    ]) {
      expect(answerCrawlers).toContain(bot);
    }
    for (const rule of list) {
      expect(rule.allow).toBe("/");
      expect(rule.disallow).toEqual(["/admin", "/api"]);
    }
  });
});

describe("analytics", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("bootstraps GA4 and the Pixel with the ID as a JSON string", () => {
    expect(gtagInit("G-ABC123")).toContain(`gtag('config',"G-ABC123")`);
    expect(pixelInit("1234567890")).toContain(`fbq('init',"1234567890")`);
    expect(pixelInit("1234567890")).toContain("connect.facebook.net");
  });

  it("reports events to GA4 and the Pixel when they are loaded", () => {
    const gtag = vi.fn();
    const fbq = vi.fn();
    vi.stubGlobal("window", { gtag, fbq });
    track("generate_lead", { form: "contact" });
    expect(gtag).toHaveBeenCalledWith("event", "generate_lead", { form: "contact" });
    expect(fbq).toHaveBeenCalledWith("track", "Lead");
    track("click_whatsapp");
    expect(fbq).toHaveBeenLastCalledWith("track", "Contact");
  });

  it("falls back to a tag manager's dataLayer, and does nothing without one", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", { dataLayer });
    track("click_call", { link_url: "tel:+994124343232" });
    expect(dataLayer).toEqual([{ event: "click_call", link_url: "tel:+994124343232" }]);
    vi.stubGlobal("window", {});
    expect(() => track("click_call")).not.toThrow();
  });

  it("lets public pages load the analytics scripts and send their hits", () => {
    const policy = contentSecurityPolicy({ dev: false, https: true, analytics: true });
    for (const origin of analyticsOrigins.script)
      expect(policy).toMatch(new RegExp(`script-src [^;]*${origin}`));
    for (const origin of analyticsOrigins.connect) expect(policy).toContain(origin);
    expect(contentSecurityPolicy({ dev: false, https: true })).not.toContain("googletagmanager");
  });
});
