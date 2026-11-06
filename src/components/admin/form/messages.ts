import type { z } from "zod";

import { isMessageKey, t, type MessageKey } from "@/lib/admin/messages";

/**
 * Console forms validate with the shared zod schemas, whose own messages are
 * English and meant for the API. The console shows Azerbaijani instead:
 *
 * - `issueMessage` is the zod error map the form kit parses with. It answers
 *   with a catalogue key and its values (`error.tooShort|{"min":2}`).
 * - `fieldMessage` turns what reaches a field into text: a catalogue key is
 *   translated (the auth schemas already use keys); anything else, a
 *   schema's English message or the server's, becomes a message by its kind.
 */

const separator = "|";

function encode(key: MessageKey, values?: Record<string, number>): string {
  return values ? `${key}${separator}${JSON.stringify(values)}` : key;
}

function isBlank(input: unknown): boolean {
  return input === undefined || input === null || input === "";
}

/** The zod error map of console forms (`useAdminForm`). */
export function issueMessage(issue: z.core.$ZodRawIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return isBlank(issue.input) ? "error.required" : "error.invalid";
    case "too_small": {
      const min = Number(issue.minimum);
      if (issue.origin === "string")
        return min <= 1 ? "error.required" : encode("error.tooShort", { min });
      if (issue.origin === "array" || issue.origin === "set")
        return encode("error.tooFew", { min });
      return encode("error.tooSmall", { min });
    }
    case "too_big": {
      const max = Number(issue.maximum);
      if (issue.origin === "string") return encode("error.tooLong", { max });
      if (issue.origin === "array" || issue.origin === "set")
        return encode("error.tooMany", { max });
      return encode("error.tooBig", { max });
    }
    case "invalid_format":
      if (issue.format === "email") return "error.email";
      if (issue.format === "url") return "error.url";
      return "error.format";
    case "invalid_value":
      return "error.choice";
    default:
      return "error.invalid";
  }
}

const byKind: Record<string, MessageKey> = {
  server: "error.server",
  invalid_format: "error.format",
  invalid_value: "error.choice",
};

/** The Azerbaijani text for a field's error (`type` is the zod issue code or `server`). */
export function fieldMessage(error: { type?: string | number; message?: string }): string {
  const message = error.message ?? "";
  const at = message.indexOf(separator);
  const key = at === -1 ? message : message.slice(0, at);
  if (isMessageKey(key)) {
    const values =
      at === -1 ? {} : (JSON.parse(message.slice(at + 1)) as Record<string, string | number>);
    return t(key, values);
  }
  return t(byKind[String(error.type)] ?? "error.invalid");
}
