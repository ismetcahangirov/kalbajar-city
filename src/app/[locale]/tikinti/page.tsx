import { PlaceholderPage, placeholderMetadata } from "@/components/i18n/placeholder-frame";

export const generateMetadata = () => placeholderMetadata("construction");

// Placeholder until the construction progress issue (#21) lands.
export default function ConstructionPage() {
  return <PlaceholderPage page="construction" />;
}
