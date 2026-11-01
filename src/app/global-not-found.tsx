import type { Metadata } from "next";
import Link from "next/link";

import az from "@/i18n/messages/az.json";

import { alethia, alethiaItalic } from "./fonts";
import "./globals.css";

// Reached only by URLs outside every locale, such as a missing file; Next
// renders it without a layout. Locale pages use [locale]/not-found.tsx.
export const metadata: Metadata = {
  title: az.NotFound.title,
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="az" className={`${alethia.variable} ${alethiaItalic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col items-center justify-center gap-6 px-gutter text-center">
        <h1 className="text-display">{az.NotFound.title}</h1>
        <p className="text-body text-text-muted">{az.NotFound.body}</p>
        <Link href="/" className="text-body font-medium underline underline-offset-4">
          {az.NotFound.home}
        </Link>
      </body>
    </html>
  );
}
