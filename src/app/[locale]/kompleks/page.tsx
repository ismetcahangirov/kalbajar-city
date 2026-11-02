import { connection } from "next/server";

import { PlaceholderPage, placeholderMetadata } from "@/components/i18n/placeholder-frame";

// Per request, like its metadata, whose canonical carries the server's origin.
export const instant = false;

export const generateMetadata = () => placeholderMetadata("complex", "/kompleks");

// Placeholder until the complex selector issue (#19) lands.
export default async function ComplexPage() {
  await connection();
  return <PlaceholderPage page="complex" />;
}
