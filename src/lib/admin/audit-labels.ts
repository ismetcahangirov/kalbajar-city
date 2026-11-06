import { auditRedacted } from "@/shared/audit";

import { adminDateTime } from "./format";
import { isMessageKey, t } from "./messages";

/** What an entry's action reads as; one not in the catalogue still names itself. */
export function auditActionLabel(action: string): string {
  const key = `audit.${action}`;
  return isMessageKey(key) ? t(key) : t("audit.other", { action });
}

/** An entity type's name; a type not in the catalogue shows as stored. */
export function auditEntityLabel(entityType: string): string {
  const key = `auditEntity.${entityType}`;
  return isMessageKey(key) ? t(key) : entityType;
}

const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** A stored text as shown: instants in Baku time, the redaction marker in words. */
function auditText(text: string): string {
  if (instant.test(text)) return adminDateTime(text);
  return text.replaceAll(auditRedacted, t("audit.log.redacted"));
}

/** A stored value as text: strings as they are, anything else as indented JSON. */
export function auditValueText(value: unknown): string {
  if (typeof value === "string") return auditText(value);
  return JSON.stringify(
    value,
    (_key, item: unknown) => (typeof item === "string" ? auditText(item) : item),
    2,
  );
}
