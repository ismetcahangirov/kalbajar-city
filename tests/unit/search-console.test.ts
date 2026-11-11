import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { contacts } from "@/config/contacts";
import az from "@/i18n/messages/az.json";
import en from "@/i18n/messages/en.json";
import ru from "@/i18n/messages/ru.json";
import { analyticsFormSchema, analyticsToForm } from "@/lib/admin/settings-forms";
import { verificationMetadata } from "@/lib/seo/metadata";
import { settingsSchemas, verificationToken } from "@/shared/settings";

/** Shapes as Search Console and Bing Webmaster Tools issue them. */
const google = "aBcD-eFgH_1234567890abcdefghijklmnopqrstuv";
const bing = "0123456789ABCDEF0123456789ABCDEF";

const typed = {
  googleAnalyticsId: "",
  metaPixelId: "",
  googleSiteVerification: "",
  bingSiteVerification: "",
};

describe("search engine verification tokens (#28, #29)", () => {
  it("takes the token from a pasted meta tag, or the token itself", () => {
    expect(verificationToken(`<meta name="google-site-verification" content="${google}" />`)).toBe(
      google,
    );
    expect(verificationToken(`<meta name='msvalidate.01' content='${bing}'>`)).toBe(bing);
    expect(verificationToken(`  ${bing}  `)).toBe(bing);
    expect(verificationToken("   ")).toBeNull();
  });

  it("saves the tokens from the console form, blanks as null", () => {
    const value = analyticsFormSchema.parse({
      ...typed,
      googleSiteVerification: `<meta name="google-site-verification" content="${google}" />`,
      bingSiteVerification: bing,
    });
    expect(value).toEqual({
      googleAnalyticsId: null,
      metaPixelId: null,
      googleSiteVerification: google,
      bingSiteVerification: bing,
    });
    // What the form saves is what the endpoint accepts.
    expect(settingsSchemas.analytics.parse(value)).toEqual(value);
    expect(analyticsToForm(value)).toEqual({
      ...typed,
      googleSiteVerification: google,
      bingSiteVerification: bing,
    });
    expect(analyticsFormSchema.parse(typed).googleSiteVerification).toBeNull();
  });

  it("rejects a value that is not the search engine's token, with a message that says so", () => {
    const result = analyticsFormSchema.safeParse({
      ...typed,
      googleSiteVerification: "not a token!",
      bingSiteVerification: "0123",
    });
    expect(result.success).toBe(false);
    const messages = Object.fromEntries(
      result.error!.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
    expect(messages).toEqual({
      googleSiteVerification: "settings.analytics.googleVerificationFormat",
      bingSiteVerification: "settings.analytics.bingVerificationFormat",
    });
  });

  it("validates the stored value at the endpoint too, and still reads rows saved before", () => {
    expect(
      settingsSchemas.analytics.safeParse({
        googleAnalyticsId: null,
        metaPixelId: null,
        bingSiteVerification: '<meta content="x">',
      }).success,
    ).toBe(false);
    expect(
      settingsSchemas.analytics.safeParse({ googleAnalyticsId: null, metaPixelId: null }).success,
    ).toBe(true);
  });

  it("emits a verification tag only for a token that is set", () => {
    expect(verificationMetadata({ google: null, bing: null })).toBeUndefined();
    expect(verificationMetadata({ google, bing: null })).toEqual({ google });
    expect(verificationMetadata({ google: null, bing })).toEqual({
      other: { "msvalidate.01": bing },
    });
    expect(verificationMetadata({ google, bing })).toEqual({
      google,
      other: { "msvalidate.01": bing },
    });
  });
});

const src = fileURLToPath(new URL("../../src", import.meta.url));
const read = (path: string) => readFileSync(join(src, path), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mts)$/.test(entry.name) ? [path] : [];
  });
}

describe("name, address and phone have one source (#29)", () => {
  it("names the complex the same in every locale", () => {
    expect(en.Shell.brand).toBe(az.Shell.brand);
    expect(ru.Shell.brand).toBe(az.Shell.brand);
  });

  it("writes the complex's phone numbers in one file", () => {
    // Every number, in any grouping: +994 12 434 32 32, (012) 434-32-32, 0124343232.
    const numbers = [...contacts.phones, contacts.whatsapp].map((e164) => e164.slice(-9));
    const allowed = new Set(["config/contacts.ts"]);
    const offenders = sourceFiles(src).filter((file) => {
      const path = relative(src, file);
      if (allowed.has(path)) return false;
      const digits = readFileSync(file, "utf8").replace(/[\s()-]/g, "");
      return numbers.some((number) => digits.includes(number));
    });
    expect(offenders.map((file) => relative(src, file))).toEqual([]);
  });

  it("gives the structured data and llms.txt the name, address and phone from getNap", () => {
    for (const path of ["components/seo/structured-data.tsx", "lib/public/llms.ts"]) {
      const code = read(path);
      expect(code, path).toContain("getNap(locale)");
      // Reading them anywhere else would let the outputs drift apart.
      expect(code, path).not.toMatch(/contacts\.(address|phones|mainPhone)\b/);
      expect(code, path).not.toMatch(/\("brand"\)/);
    }
    // getNap reads the contacts the header, footer and contact page show,
    // and the wordmark's name.
    const nap = read("lib/seo/nap.ts");
    expect(nap).toContain("getSiteContacts(locale)");
    expect(nap).toContain('shell("brand")');
    expect(read("components/shell/wordmark.tsx")).toContain('t("brand")');
    expect(read("app/[locale]/layout.tsx")).toContain("getSiteContacts(locale)");
  });
});
