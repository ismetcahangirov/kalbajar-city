import { auditRedacted } from "@/shared/audit";

/**
 * Secrets out of what the audit log shows. `audit()` already drops the columns
 * it knows are secret, but only those exact names and only at the top level,
 * and the log is never rewritten, so whatever an older write or a nested value
 * let through is still in the table. Everything leaving the server for the
 * viewer passes through here, so a client can never receive it.
 *
 * It errs towards hiding: a field wrongly hidden still shows that it changed.
 */

/** A field is secret if its name, without case or separators, contains one of these. */
const secretNameParts = [
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "apikey",
  "privatekey",
  "accesskey",
  "credential",
  "signature",
];

/** Too common as parts of names (`blurhash`, `cookieNotice`), so matched whole. */
const secretNames = new Set(["authorization", "cookie", "setcookie", "hash", "salt", "otp"]);

export function isSecretField(name: string): boolean {
  const normal = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return secretNames.has(normal) || secretNameParts.some((part) => normal.includes(part));
}

/**
 * Secrets recognisable inside any text, whatever its field is called. Each
 * starts on a literal, not a run of word characters, so a very long text (a
 * news body) cannot make them backtrack.
 */
const secretPatterns: Array<[RegExp, string]> = [
  // `name=value`, `name: value`, `"name":"value"`: query strings, form bodies,
  // JSON kept as text. The name stays, so the entry still says what was there.
  [
    /((?:password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key|credential|signature)[\w.-]*["']?\s*[:=]\s*["']?)[^\s&"',;}]+/gi,
    `$1${auditRedacted}`,
  ],
  // The password in a connection string.
  [/(:\/\/[^\s:/@]+:)[^\s@/]+@/g, `$1${auditRedacted}@`],
  // A password reset's verification identifier.
  [/(reset-password:)[^\s"']+/g, `$1${auditRedacted}`],
  // Password hashes: bcrypt, PHC strings, Better Auth's scrypt `salt:key`.
  [/\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}/g, auditRedacted],
  [/\$(?:argon2(?:id|i|d)|scrypt|pbkdf2[\w-]*)\$\S+/g, auditRedacted],
  [/\b[0-9a-f]{32}:[0-9a-f]{128}\b/gi, auditRedacted],
  // JSON Web Tokens and HTTP credentials.
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, auditRedacted],
  [/\b(Bearer|Basic)\s+[\w.~+/=-]{16,}/gi, `$1 ${auditRedacted}`],
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    auditRedacted,
  ],
];

/** A text with every secret in it replaced. */
export function redactText(text: string): string {
  return secretPatterns.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}

/**
 * A stored value with its secrets replaced, at any depth. A secret field keeps
 * its name, so a changed password still reads as changed; `null` stays `null`,
 * which only says it was empty.
 */
export function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      redactText(key),
      isSecretField(key) && item !== null ? auditRedacted : redactValue(item),
    ]),
  );
}
