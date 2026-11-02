import { t, type MessageKey } from "@/lib/admin/messages";

/** A settings section's heading and what it changes on the site. */
export function SectionHeader({ title, lead }: { title: MessageKey; lead: MessageKey }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-medium">{t(title)}</h2>
      <p className="text-sm text-muted-foreground">{t(lead)}</p>
    </div>
  );
}
