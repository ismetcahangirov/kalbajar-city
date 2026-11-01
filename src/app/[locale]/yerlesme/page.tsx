import { PlaceholderPage, placeholderMetadata } from "@/components/i18n/placeholder-frame";

export const generateMetadata = () => placeholderMetadata("location");

// Placeholder until the location page issue (#20) lands.
export default function LocationPage() {
  return <PlaceholderPage page="location" />;
}
