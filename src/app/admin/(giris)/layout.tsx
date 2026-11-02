import { t } from "@/lib/admin/messages";

/** Sign-in and password pages: one narrow card, centred from tablet up. */
export default function AuthLayout({ children }: LayoutProps<"/admin">) {
  return (
    <main className="flex min-h-svh items-start justify-center bg-surface-alt px-gutter py-section sm:items-center">
      <div className="w-full max-w-md rounded-md border border-border bg-surface-raised p-6 sm:p-8">
        <p className="mb-6 text-small font-medium text-text-muted">{t("brand")}</p>
        {children}
      </div>
    </main>
  );
}
