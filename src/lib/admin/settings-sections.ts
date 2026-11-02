import { scopeOf } from "@/shared/placeholders";

import { isMessageKey, t, type MessageKey } from "./messages";
import { adminModules } from "./navigation";

const base = adminModules.settings.href;

/**
 * The settings screen's sections (#27), one form each. Routes are
 * Azerbaijani; the first section is the screen itself. `scope` is the
 * placeholder scope its form saves (`@/shared/placeholders`).
 */
export const settingsSections = [
  { id: "elaqe", href: base, label: "settings.nav.contacts", scope: "contacts" },
  { id: "sosial", href: `${base}/sosial`, label: "settings.nav.socials", scope: "socials" },
  {
    id: "developer",
    href: `${base}/developer`,
    label: "settings.nav.developer",
    scope: "developer",
  },
  { id: "kompleks", href: `${base}/kompleks`, label: "settings.nav.complex", scope: "complex" },
  { id: "qiymetler", href: `${base}/qiymetler`, label: "settings.nav.prices", scope: "prices" },
  {
    id: "analitika",
    href: `${base}/analitika`,
    label: "settings.nav.analytics",
    scope: "analytics",
  },
  {
    id: "yerlesme",
    href: `${base}/yerlesme`,
    label: "settings.nav.location",
    scope: "homeLocation",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  href: string;
  label: MessageKey;
  scope: string;
}>;

export type SettingsSectionId = (typeof settingsSections)[number]["id"];

export type SettingsSection = (typeof settingsSections)[number];

export function settingsSection(id: SettingsSectionId): SettingsSection {
  return settingsSections.find((section) => section.id === id)!;
}

/** The section whose form edits a placeholder's value, if any. */
export function sectionOfPath(path: string): SettingsSection | null {
  const scope = scopeOf(path);
  return settingsSections.find((section) => section.scope === scope) ?? null;
}

/** The lead settings live with the leads module (#26); the screen links to them. */
export const leadSettingsHref = `${adminModules.leads.href}/ayarlar`;

/** A flagged field's name ("Ünvan"), or the path itself. */
export function placeholderField(path: string): string {
  const key = `placeholder.${path}`;
  return isMessageKey(key) ? t(key) : path;
}

/** A flagged field's name with its section ("Əlaqə · Ünvan"). */
export function placeholderLabel(path: string): string {
  const section = sectionOfPath(path);
  const field = placeholderField(path);
  return section ? `${t(section.label)} · ${field}` : field;
}
