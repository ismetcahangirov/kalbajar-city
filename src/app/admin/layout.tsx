import type { Metadata } from "next";

import { t } from "@/lib/admin/messages";
import { StoreProvider } from "@/store/provider";

import "./admin.css";

export const metadata: Metadata = {
  title: { default: t("meta.title"), template: `%s · ${t("meta.title")}` },
  robots: { index: false, follow: false },
};

/** The console's root layout: Azerbaijani only, no public header or footer. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="az" className="h-full antialiased">
      <body className="min-h-full">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
