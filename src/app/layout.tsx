import type { Metadata } from "next";

import { alethia, alethiaItalic } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kalbajar City",
  description: "Kəlbəcərin ilk özəl yaşayış kompleksi",
};

// The locale-aware layout replaces this root in the internationalisation issue (#12).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="az" className={`${alethia.variable} ${alethiaItalic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
