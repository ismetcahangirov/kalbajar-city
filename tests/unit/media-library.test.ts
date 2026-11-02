import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { guardAdmin } from "@/lib/auth/guard";
import {
  describeUsage,
  formatDuration,
  formatFileSize,
  mediaListParams,
} from "@/lib/admin/media-list";
import { readTableState, tableSearch, withFilter, withView } from "@/lib/admin/table-state";
import { checkUpload, posterFileName, uploadProblemOf } from "@/lib/admin/upload";
import { posterTime } from "@/lib/admin/video-frame";
import { consoleContentSecurityPolicy, contentSecurityPolicy, originOf } from "@/lib/security/csp";
import { mediaListQuerySchema } from "@/shared/media";

const NBSP = " ";

const connectSrc = (policy: string) =>
  policy.split("; ").find((directive) => directive.startsWith("connect-src"));

describe("content security policy", () => {
  it("lets the console reach the object store, and only the console", () => {
    const env = { S3_ENDPOINT: "https://s3.example.com:9000/", NEXT_PUBLIC_SITE_URL: "https://x" };
    const consolePolicy = consoleContentSecurityPolicy(env);
    expect(connectSrc(consolePolicy)).toBe("connect-src 'self' https://s3.example.com:9000");
    expect(consolePolicy).toContain("upgrade-insecure-requests");

    const publicPolicy = contentSecurityPolicy({ dev: false, https: true });
    expect(connectSrc(publicPolicy)).toBe("connect-src 'self'");
    // The rest of the two policies is the same.
    expect(consolePolicy.replace(" https://s3.example.com:9000", "")).toBe(publicPolicy);
  });

  it("never widens the policy from a missing or odd endpoint", () => {
    expect(connectSrc(consoleContentSecurityPolicy({}))).toBe("connect-src 'self'");
    expect(originOf("not a url")).toBeNull();
    expect(originOf("javascript:alert(1)")).toBeNull();
    expect(originOf("http://localhost:9010/bucket")).toBe("http://localhost:9010");
  });

  describe("on console pages", () => {
    afterEach(() => vi.unstubAllEnvs());
    const request = (path: string, cookie?: string) =>
      new NextRequest(new URL(path, "http://localhost:3010"), {
        headers: cookie ? { cookie } : {},
      });

    it("is set at request time from S3_ENDPOINT", () => {
      vi.stubEnv("S3_ENDPOINT", "http://localhost:9010");
      const page = guardAdmin(request("/admin/media", "better-auth.session_token=a.b"));
      expect(connectSrc(page.headers.get("content-security-policy") ?? "")).toBe(
        "connect-src 'self' http://localhost:9010",
      );
      expect(guardAdmin(request("/admin/giris")).headers.get("content-security-policy")).toContain(
        "http://localhost:9010",
      );
      // The API answers JSON; no policy is needed there.
      const api = guardAdmin(request("/api/v1/admin/media", "better-auth.session_token=a.b"));
      expect(api.headers.get("content-security-policy")).toBeNull();
    });
  });
});

describe("upload checks", () => {
  it("knows what the library takes before anything is sent", () => {
    expect(checkUpload({ type: "image/jpeg", size: 1024 })).toBe("image");
    expect(checkUpload({ type: "video/mp4", size: 70 * 1024 * 1024 })).toBe("video");
    expect(checkUpload({ type: "image/heic", size: 1024 })).toBe("type");
    expect(checkUpload({ type: "video/quicktime", size: 1024 })).toBe("type");
    expect(checkUpload({ type: "image/png", size: 41 * 1024 * 1024 })).toBe("size");
    expect(checkUpload({ type: "image/png", size: 0 })).toBe("size");
  });

  it("turns the API's errors into the editor's problem", () => {
    const api = (code: string, fields?: Record<string, string[]>) => ({
      status: 422,
      data: { error: { code, message: "x", fields } },
    });
    expect(uploadProblemOf(api("UNSUPPORTED_FILE"))).toBe("type");
    expect(uploadProblemOf(api("UNSUPPORTED_VIDEO_CODEC"))).toBe("codec");
    expect(uploadProblemOf(api("FILE_TOO_LARGE"))).toBe("size");
    expect(uploadProblemOf(api("VALIDATION_FAILED", { size: ["too big"] }))).toBe("size");
    expect(uploadProblemOf(api("VALIDATION_FAILED", { key: ["expired"] }))).toBe("storage");
    expect(uploadProblemOf({ status: "FETCH_ERROR", error: "offline" })).toBe("network");
    expect(uploadProblemOf(api("FORBIDDEN"))).toBe("generic");
  });

  it("names a poster frame after its video", () => {
    expect(posterFileName("kənd yolu.mp4")).toBe("kənd yolu-poster.jpg");
    expect(posterFileName(null)).toBe("video-poster.jpg");
    expect(posterFileName(".mp4")).toBe("video-poster.jpg");
  });

  it("takes the poster 1 s in, or 10 % into a shorter video", () => {
    expect(posterTime(60)).toBe(1);
    expect(posterTime(4)).toBeCloseTo(0.4);
    expect(posterTime(Number.NaN)).toBe(0);
  });
});

describe("library list state", () => {
  const spec = {
    sortFields: ["createdAt"],
    defaultSort: "-createdAt",
    filters: { axtar: "text", nov: ["image", "video"], alt: ["yoxdur"] },
    views: ["sebeke", "siyahi"],
  } as const;
  const read = (search: string) => readTableState(new URLSearchParams(search), spec);

  it("keeps a search whole and the view in the URL", () => {
    const state = read("axtar=dağ,%20çay&gorunus=siyahi&nov=video");
    expect(state).toEqual({
      page: 1,
      sort: "-createdAt",
      filters: { axtar: ["dağ, çay"], nov: ["video"] },
      view: "siyahi",
    });
    expect(tableSearch(state, spec)).toBe("?axtar=da%C4%9F%2C+%C3%A7ay&nov=video&gorunus=siyahi");
    expect(tableSearch(withView(state, "sebeke"), spec)).toBe(
      "?axtar=da%C4%9F%2C+%C3%A7ay&nov=video",
    );
    expect(read("gorunus=other").view).toBe("sebeke");
    expect(read(`axtar=${"a".repeat(150)}`).filters.axtar?.[0]).toHaveLength(100);
  });

  it("maps the URL state onto the list endpoint's query", () => {
    const state = withFilter(read("axtar=dağ&sehife=2"), "alt", ["yoxdur"]);
    const params = mediaListParams({ ...state, page: 2, pageSize: 24 });
    expect(params).toEqual({
      page: 2,
      pageSize: 24,
      sort: "-createdAt",
      q: "dağ",
      kind: undefined,
      source: undefined,
      missingAlt: true,
    });
    // RTK Query sends booleans as text; the endpoint reads them back.
    const query = mediaListQuerySchema.parse({ q: params.q, missingAlt: "true", kind: "image" });
    expect(query).toMatchObject({
      q: "dağ",
      missingAlt: true,
      kind: ["image"],
      sort: { field: "createdAt", direction: "desc" },
    });
  });
});

describe("library text", () => {
  it("says where a file is used and links where to change it", () => {
    expect(
      describeUsage({ entityType: "news", entityId: "n1", field: "cover", label: "acilis" }),
    ).toEqual({ label: "Xəbərin üz şəkli: acilis", href: "/admin/xeberler" });
    expect(
      describeUsage({ entityType: "media", entityId: "v1", field: "poster", label: null }),
    ).toEqual({ label: "Videonun posteri: Adsız fayl", href: "/admin/media/v1" });
    expect(
      describeUsage({ entityType: "rich_text", entityId: "x", field: "body", label: null }),
    ).toEqual({ label: "rich_text", href: null });
  });

  it("formats sizes and durations the Azerbaijani way", () => {
    expect(formatFileSize(1_250_000)).toBe(`1,2${NBSP}MB`);
    expect(formatFileSize(300)).toBe(`1${NBSP}KB`);
    expect(formatFileSize(640 * 1024)).toBe(`640${NBSP}KB`);
    expect(formatDuration(65_400)).toBe("1:05");
  });
});
