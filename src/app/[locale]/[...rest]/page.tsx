import { notFound } from "next/navigation";

// Unknown paths inside a locale render that locale's not-found page instead
// of the global one. Blocking, so the 404 arrives as complete HTML instead of
// an error shell that renders on the client.
export const instant = false;

export default function CatchAll() {
  notFound();
}
