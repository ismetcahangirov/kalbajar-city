// Prepares the object store for the media pipeline (#11). Safe to run again.
//
//   pnpm storage:setup
//
// - creates the bucket when it is missing
// - CORS: browsers may PUT from the site's origins (NEXT_PUBLIC_SITE_URL,
//   BETTER_AUTH_URL), which is how the console sends presigned uploads, and
//   GET, so the console can draw a stored video's frame on a canvas for its
//   poster (#25); without CORS the canvas could not be read
// - policy: anonymous read of `media/*` only; uploads and originals stay private
// - lifecycle: `uploads/` expires after a day, so abandoned uploads do not pile up
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import { S3, S3Error, s3ConfigFromEnv } from "../src/lib/s3";

if (existsSync(".env")) process.loadEnvFile(".env");

const s3 = new S3(s3ConfigFromEnv());
const { bucket, region } = s3.config;

const origins = [
  ...new Set(
    [process.env.NEXT_PUBLIC_SITE_URL, process.env.BETTER_AUTH_URL]
      .filter((value): value is string => !!value)
      .map((value) => new URL(value).origin),
  ),
];
if (!origins.length) throw new Error("Set NEXT_PUBLIC_SITE_URL or BETTER_AUTH_URL (.env.example)");

/** PutBucketCors and PutBucketLifecycleConfiguration require Content-MD5. */
function withMd5(body: string): RequestInit {
  const md5 = createHash("md5").update(body).digest("base64");
  return { method: "PUT", body, headers: { "content-md5": md5 } };
}

async function ensureBucket(): Promise<void> {
  const head = await s3.fetch(s3.url(), { method: "HEAD" });
  if (head.ok) {
    console.log(`bucket ${bucket} exists`);
    return;
  }
  if (head.status !== 404) throw new Error(`HEAD bucket ${bucket} answered ${head.status}`);
  const body =
    region === "us-east-1"
      ? undefined
      : `<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LocationConstraint>${region}</LocationConstraint></CreateBucketConfiguration>`;
  await s3.send(s3.url(), { method: "PUT", body });
  console.log(`bucket ${bucket} created`);
}

async function putCors(): Promise<void> {
  const rule = [
    "<CORSRule>",
    ...origins.map((origin) => `<AllowedOrigin>${origin}</AllowedOrigin>`),
    "<AllowedMethod>PUT</AllowedMethod>",
    "<AllowedMethod>GET</AllowedMethod>",
    "<AllowedHeader>content-type</AllowedHeader>",
    "<ExposeHeader>ETag</ExposeHeader>",
    "<MaxAgeSeconds>3600</MaxAgeSeconds>",
    "</CORSRule>",
  ].join("");
  const body = `<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${rule}</CORSConfiguration>`;
  await s3.send(s3.url("", "?cors"), withMd5(body));
  console.log(`CORS: PUT and GET from ${origins.join(", ")}`);
}

async function putPolicy(): Promise<void> {
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicMedia",
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/media/*`],
      },
    ],
  };
  await s3.send(s3.url("", "?policy"), {
    method: "PUT",
    body: JSON.stringify(policy),
    headers: { "content-type": "application/json" },
  });
  console.log("policy: public read of media/* only");
}

async function putLifecycle(): Promise<void> {
  const body = [
    `<LifecycleConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">`,
    "<Rule><ID>expire-uploads</ID><Filter><Prefix>uploads/</Prefix></Filter><Status>Enabled</Status>",
    "<Expiration><Days>1</Days></Expiration>",
    "<AbortIncompleteMultipartUpload><DaysAfterInitiation>1</DaysAfterInitiation></AbortIncompleteMultipartUpload>",
    "</Rule></LifecycleConfiguration>",
  ].join("");
  try {
    await s3.send(s3.url("", "?lifecycle"), withMd5(body));
    console.log("lifecycle: uploads/ expire after 1 day");
  } catch (error) {
    // Some S3-compatible stores have no lifecycle support. Abandoned uploads
    // then stay until removed by hand, which costs space but breaks nothing.
    if (error instanceof S3Error && (error.status === 501 || error.s3Code === "NotImplemented")) {
      console.warn(
        "warning: the store does not implement lifecycle rules; uploads/ will not expire",
      );
      return;
    }
    throw error;
  }
}

await ensureBucket();
await putCors();
await putPolicy();
await putLifecycle();
console.log(`bucket ${bucket} ready`);
