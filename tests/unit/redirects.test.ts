import { describe, expect, it } from "vitest";

import { resolveRedirect, type RedirectTable } from "@/lib/redirects/serve";
import {
  analyzeRedirect,
  internalPath,
  normalizePath,
  proxySeesPath,
  redirectCreateSchema,
  type RedirectEdge,
} from "@/shared/redirects";

const edge = (from: string, to: string, id = from): RedirectEdge => ({ id, from, to });

describe("redirect paths", () => {
  it("compares paths decoded and without a trailing slash", () => {
    expect(normalizePath("/k%C3%B6hn%C9%99/")).toBe("/köhnə");
    expect(normalizePath(" /a// ")).toBe("/a");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/%E0%A4%A")).toBe("/%E0%A4%A");
  });

  it("treats only site paths as internal destinations", () => {
    expect(internalPath("/elaqe/?utm=x#form")).toBe("/elaqe");
    expect(internalPath("https://example.com/a")).toBeNull();
    expect(internalPath("//example.com/a")).toBeNull();
  });

  it("mirrors the proxy matcher, so a saved source always reaches the proxy", () => {
    const matcher = /^\/((?!api|admin|_next|_vercel|.*\..*).*)$/;
    for (const path of [
      "/kohne",
      "/en/kohne",
      "/menziller/a-101",
      "/apidocs",
      "/administration",
      "/index.html",
      "/_next/x",
      "/a.b/c",
    ]) {
      expect(proxySeesPath(path), path).toBe(matcher.test(path));
    }
  });
});

describe("redirectCreateSchema", () => {
  const parse = (body: Record<string, unknown>) =>
    redirectCreateSchema.safeParse({ fromPath: "/a", toPath: "/b", statusCode: 301, ...body });

  it("normalises the source and destination and reads the status from a form", () => {
    const result = parse({ fromPath: " /Köhnə/ ", toPath: "/yeni/?x=1", statusCode: "302" });
    expect(result.success && result.data).toEqual({
      fromPath: "/Köhnə",
      toPath: "/yeni?x=1",
      statusCode: 302,
    });
  });

  it("refuses sources the proxy never sees, the home page and queries", () => {
    for (const fromPath of [
      "kohne",
      "//evil.com",
      "/",
      "/index.html",
      "/admin/x",
      "/a?b=1",
      "/a b",
    ]) {
      expect(parse({ fromPath }).success, fromPath).toBe(false);
    }
  });

  it("accepts site paths and http(s) URLs as destinations, nothing else", () => {
    expect(parse({ toPath: "https://instagram.com/kalbajarcity" }).success).toBe(true);
    for (const toPath of ["javascript:alert(1)", "//evil.com", "elaqe", "/a\\b", "ftp://x"]) {
      expect(parse({ toPath }).success, toPath).toBe(false);
    }
    expect(parse({ statusCode: 307 }).success).toBe(false);
  });
});

describe("analyzeRedirect", () => {
  it("finds a loop through other redirects", () => {
    const edges = [edge("/b", "/c"), edge("/c", "/a")];
    expect(analyzeRedirect(edges, { from: "/a", to: "/b" })).toEqual({
      kind: "loop",
      cycle: ["/a", "/b", "/c", "/a"],
    });
  });

  it("finds a loop that does not come back to the new source", () => {
    const edges = [edge("/b", "/c"), edge("/c", "/b")];
    expect(analyzeRedirect(edges, { from: "/a", to: "/b" })).toMatchObject({
      kind: "loop",
      cycle: ["/a", "/b", "/c", "/b"],
    });
  });

  it("sees a loop through a destination with a query or a trailing slash", () => {
    const edges = [edge("/b", "/a/?from=b")];
    expect(analyzeRedirect(edges, { from: "/a", to: "/b#x" }).kind).toBe("loop");
  });

  it("sees a loop through legacy redirects, which have no id", () => {
    const edges = [{ from: "/laq", to: "/elaqe" }];
    expect(analyzeRedirect(edges, { from: "/elaqe", to: "/laq" }).kind).toBe("loop");
  });

  it("replaces the edited row instead of following its old destination", () => {
    const edges = [edge("/a", "/b", "1"), edge("/b", "/a-old", "2")];
    expect(analyzeRedirect(edges, { id: "1", from: "/a", to: "/c" })).toEqual({
      kind: "ok",
      hops: ["/a", "/c"],
      final: "/c",
      incoming: [],
    });
  });

  it("reports a chain forwards to its final destination", () => {
    const edges = [edge("/b", "/c"), edge("/c", "https://example.com/?q=1")];
    expect(analyzeRedirect(edges, { from: "/a", to: "/b" })).toEqual({
      kind: "ok",
      hops: ["/a", "/b", "/c", "https://example.com/?q=1"],
      final: "https://example.com/?q=1",
      incoming: [],
    });
  });

  it("reports the redirects that already point at the new source", () => {
    const edges = [edge("/x", "/a"), edge("/y", "/a/"), { from: "/laq", to: "/a" }];
    const result = analyzeRedirect(edges, { from: "/a", to: "/b" });
    expect(result.kind === "ok" && result.incoming.map((item) => item.from)).toEqual(["/x", "/y"]);
  });

  it("does not follow external destinations", () => {
    const edges = [edge("/b", "/a")];
    expect(analyzeRedirect(edges, { from: "/a", to: "https://site.test/b" }).kind).toBe("ok");
  });
});

describe("resolveRedirect", () => {
  const table: RedirectTable = new Map([
    ["/kohne", { id: "1", to: "/yeni", status: 301 }],
    ["/köhnə", { id: "2", to: "/elaqe?tab=form#map", status: 302 }],
    ["/instagram", { id: "3", to: "https://instagram.com/kalbajar", status: 302 }],
  ]);
  const at = (path: string) => resolveRedirect(table, new URL(path, "http://0.0.0.0:3000"));

  it("matches the normalised path and answers with a relative location", () => {
    expect(at("/kohne/")).toEqual({ id: "1", location: "/yeni", status: 301 });
    expect(at("/k%C3%B6hn%C9%99")).toEqual({
      id: "2",
      location: "/elaqe?tab=form#map",
      status: 302,
    });
    expect(at("/yeni")).toBeNull();
  });

  it("carries the query over unless the destination has its own", () => {
    expect(at("/kohne?utm_source=ig")?.location).toBe("/yeni?utm_source=ig");
    expect(at("/köhnə?utm_source=ig")?.location).toBe("/elaqe?tab=form#map");
    expect(at("/instagram?a=1")?.location).toBe("https://instagram.com/kalbajar?a=1");
  });

  it("encodes non-ASCII destinations for the Location header", () => {
    const encoded = resolveRedirect(
      new Map([["/a", { id: "1", to: "/xəbərlər", status: 301 }]]),
      new URL("http://x/a"),
    );
    expect(encoded?.location).toBe("/x%C9%99b%C9%99rl%C9%99r");
  });
});
