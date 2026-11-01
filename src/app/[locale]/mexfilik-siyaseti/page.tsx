import { PlaceholderPage, placeholderMetadata } from "@/components/i18n/placeholder-frame";

export const generateMetadata = () => placeholderMetadata("privacy");

// Placeholder until the privacy notice page issue (#20) lands.
export default function PrivacyPage() {
  return <PlaceholderPage page="privacy" />;
}
