import { AwsClient } from "aws4fetch";

/**
 * A minimal S3 client over `aws4fetch` (#11): path-style URLs, so it works the
 * same against RustFS in development and any S3-compatible store in
 * production. Application code uses `@/lib/storage`, which reads the
 * configuration lazily; `scripts/storage-setup.mts` uses this directly.
 */

export type S3Config = {
  /** The API origin, e.g. `http://localhost:9010`. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Where the bucket's public-read objects are served from, without a trailing slash. */
  publicUrl: string;
};

const required = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_PUBLIC_URL",
] as const;

/** Reads `S3_*` (see `.env.example`); throws naming every missing variable. */
export function s3ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3Config {
  const missing = required.filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(`Object storage is not configured: set ${missing.join(", ")} (.env.example)`);
  }
  return {
    endpoint: env.S3_ENDPOINT!.replace(/\/+$/, ""),
    region: env.S3_REGION!,
    bucket: env.S3_BUCKET!,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    publicUrl: env.S3_PUBLIC_URL!.replace(/\/+$/, ""),
  };
}

/** A key with each segment URL-encoded and the slashes kept. */
export function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export class S3Error extends Error {
  constructor(
    readonly status: number,
    readonly s3Code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "S3Error";
  }
}

export class S3 {
  readonly client: AwsClient;

  constructor(readonly config: S3Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      service: "s3",
    });
  }

  /**
   * A signed request. The original body is sent, not the signed `Request`'s
   * stream: a streamed body goes out chunked, without the Content-Length S3
   * requires (Next's fetch does this; plain Node keeps the length).
   */
  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const signed = await this.client.sign(url, init);
    return fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: init.body,
      cache: "no-store",
    });
  }

  /** The bucket's URL, or an object's with `key`. */
  url(key = "", query = ""): string {
    const base = `${this.config.endpoint}/${encodeURIComponent(this.config.bucket)}`;
    return `${key ? `${base}/${encodeKey(key)}` : base}${query}`;
  }

  /** Sends a signed request and throws `S3Error` unless the answer is 2xx. */
  async send(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.fetch(url, init);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? null;
      throw new S3Error(
        response.status,
        code,
        `S3 ${init.method ?? "GET"} ${new URL(url).pathname} answered ${response.status}${code ? ` ${code}` : ""}`,
      );
    }
    return response;
  }

  /**
   * A presigned PUT. `headers` are part of the signature, so the uploader must
   * send exactly these (a different type or length is refused by the store).
   */
  async presignPut(
    key: string,
    { headers, expiresIn }: { headers: Record<string, string>; expiresIn: number },
  ): Promise<string> {
    const url = new URL(this.url(key));
    url.searchParams.set("X-Amz-Expires", String(expiresIn));
    const signed = await this.client.sign(url.toString(), {
      method: "PUT",
      headers,
      aws: { signQuery: true, allHeaders: true },
    });
    return signed.url;
  }

  async put(
    key: string,
    body: Uint8Array,
    { contentType, cacheControl }: { contentType: string; cacheControl?: string },
  ): Promise<void> {
    await this.send(this.url(key), {
      method: "PUT",
      body: body as BodyInit,
      headers: {
        "content-type": contentType,
        ...(cacheControl ? { "cache-control": cacheControl } : {}),
      },
    });
  }

  /** The object's size and type, or null when it does not exist. */
  async head(key: string): Promise<{ size: number; contentType: string | null } | null> {
    const response = await this.fetch(this.url(key), { method: "HEAD" });
    if (response.status === 404) return null;
    if (!response.ok)
      throw new S3Error(response.status, null, `S3 HEAD answered ${response.status}`);
    return {
      size: Number(response.headers.get("content-length") ?? 0),
      contentType: response.headers.get("content-type"),
    };
  }

  async get(key: string): Promise<Uint8Array> {
    const response = await this.send(this.url(key));
    return new Uint8Array(await response.arrayBuffer());
  }

  /** A server-side copy within the bucket. */
  async copy(
    from: string,
    to: string,
    { contentType, cacheControl }: { contentType: string; cacheControl?: string },
  ): Promise<void> {
    await this.send(this.url(to), {
      method: "PUT",
      headers: {
        "x-amz-copy-source": `/${encodeURIComponent(this.config.bucket)}/${encodeKey(from)}`,
        "x-amz-metadata-directive": "REPLACE",
        "content-type": contentType,
        ...(cacheControl ? { "cache-control": cacheControl } : {}),
      },
    });
  }

  /** Deletes an object; deleting one that is already gone succeeds. */
  async delete(key: string): Promise<void> {
    const response = await this.fetch(this.url(key), { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      throw new S3Error(response.status, null, `S3 DELETE answered ${response.status}`);
    }
  }
}
