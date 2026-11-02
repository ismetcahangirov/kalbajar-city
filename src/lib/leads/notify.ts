import "server-only";

import { eq } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { apartments, blocks, floors, leadEvents, leads, settings } from "@/db/schema";
import { formatPhone } from "@/i18n/format";
import { t } from "@/lib/admin/messages";
import { escapeHtml, sendMail } from "@/lib/mail";
import { settingsSchemas } from "@/shared/settings";

/**
 * The public origin, read at run time. A literal `process.env.NEXT_PUBLIC_*`
 * is inlined at build time, and the build does not know the production URL.
 */
function siteUrl(): string {
  const names = ["NEXT_PUBLIC_SITE_URL", "BETTER_AUTH_URL"] as const;
  for (const name of names) {
    const value = process.env[name];
    if (value) return value.replace(/\/+$/, "");
  }
  throw new Error("NEXT_PUBLIC_SITE_URL is not set (see .env.example)");
}

/** `LEADS_INBOX` (one or more comma-separated addresses), else the contacts e-mail. */
async function recipient(db: Executor): Promise<string | null> {
  const inbox = process.env.LEADS_INBOX?.trim();
  if (inbox) return inbox;
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "contacts"));
  return settingsSchemas.contacts.safeParse(row?.value).data?.email ?? null;
}

type Row = { label: string; value: string; href?: string };

/** The lead as labelled rows, without the ones it does not have. */
async function rowsOf(db: Executor, id: string, site: string) {
  const [lead] = await db
    .select({
      lead: leads,
      apartment: { slug: apartments.slug, number: apartments.number },
      block: blocks.code,
    })
    .from(leads)
    .leftJoin(apartments, eq(apartments.id, leads.apartmentId))
    .leftJoin(floors, eq(floors.id, apartments.floorId))
    .leftJoin(blocks, eq(blocks.id, floors.blockId))
    .where(eq(leads.id, id));
  if (!lead) throw new Error(`Lead ${id} not found`);
  const { lead: l, apartment, block } = lead;

  const preferred = l.preferredAt
    ? new Intl.DateTimeFormat("az", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Baku",
      }).format(l.preferredAt)
    : null;
  const utm = Object.entries(l.utm ?? {})
    .map(([key, value]) => `utm_${key}=${value}`)
    .join(", ");

  const rows: Array<Row | null> = [
    { label: t("mail.lead.type"), value: t(`lead.type.${l.type}`) },
    { label: t("mail.lead.name"), value: l.name },
    { label: t("mail.lead.phone"), value: formatPhone(l.phone), href: `tel:${l.phone}` },
    l.email ? { label: t("mail.lead.email"), value: l.email, href: `mailto:${l.email}` } : null,
    preferred ? { label: t("mail.lead.preferredAt"), value: preferred } : null,
    apartment
      ? {
          label: t("mail.lead.apartment"),
          value: block ? `${block}-${apartment.number}` : apartment.number,
          href: `${site}/menziller/${apartment.slug}`,
        }
      : null,
    l.message ? { label: t("mail.lead.message"), value: l.message } : null,
    { label: t("mail.lead.sourcePath"), value: l.sourcePath, href: `${site}${l.sourcePath}` },
    { label: t("mail.lead.locale"), value: l.locale },
    utm ? { label: t("mail.lead.utm"), value: utm } : null,
    l.referrer ? { label: t("mail.lead.referrer"), value: l.referrer } : null,
  ];
  return { lead: l, rows: rows.filter((row) => row !== null) };
}

/** Builds the sales e-mail for a stored lead. Every value is escaped in the HTML part. */
export async function leadMail(db: Executor, id: string) {
  const site = siteUrl();
  const { lead, rows } = await rowsOf(db, id, site);
  const consoleUrl = `${site}/admin/muracietler/${lead.id}`;
  // A name is one line in a subject, whatever was typed.
  const name = lead.name.replace(/[\r\n\t]+/g, " ");
  const type = t(`lead.type.${lead.type}`);

  const text = [
    t("mail.lead.lead"),
    ...rows.map((row) => `${row.label}: ${row.value}`),
    `${t("mail.lead.open")}: ${consoleUrl}`,
  ].join("\n");

  const cell = "padding:4px 16px 4px 0;vertical-align:top;text-align:left";
  const html = [
    `<p>${escapeHtml(t("mail.lead.lead"))}</p>`,
    "<table>",
    ...rows.map((row) => {
      const value = escapeHtml(row.value).replace(/\n/g, "<br>");
      const content = row.href ? `<a href="${escapeHtml(row.href)}">${value}</a>` : value;
      return `<tr><th style="${cell}">${escapeHtml(row.label)}</th><td style="${cell}">${content}</td></tr>`;
    }),
    "</table>",
    `<p><a href="${escapeHtml(consoleUrl)}">${escapeHtml(t("mail.lead.open"))}</a></p>`,
  ].join("\n");

  return {
    subject: t("mail.lead.subject", { type, name }),
    text,
    html,
    replyTo: lead.email ?? undefined,
  };
}

/**
 * E-mails a committed lead to the sales inbox and records the attempt on the
 * lead's timeline. It never throws: a lost e-mail must not lose the lead,
 * which the console lists either way.
 */
export async function notifyLead(db: Executor, id: string): Promise<boolean> {
  let ok = false;
  let error: string | undefined;
  try {
    const to = await recipient(db);
    if (!to) throw new Error("No sales inbox: set LEADS_INBOX or the contacts e-mail");
    await sendMail({ to, ...(await leadMail(db, id)) });
    ok = true;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
    console.error(`Lead ${id}: the sales e-mail was not sent`, cause);
  }
  try {
    await db
      .insert(leadEvents)
      .values({ leadId: id, type: "notified", data: ok ? { ok } : { ok, error } });
  } catch (cause) {
    console.error(`Lead ${id}: the notification was not recorded`, cause);
  }
  return ok;
}
