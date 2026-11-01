import { PlaceholderPage, placeholderMetadata } from "@/components/i18n/placeholder-frame";

export const generateMetadata = () => placeholderMetadata("complex");

// Placeholder until the complex selector issue (#19) lands.
export default function ComplexPage() {
  return <PlaceholderPage page="complex" />;
}
