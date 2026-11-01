import { PlaceholderPage, placeholderMetadata } from "@/components/i18n/placeholder-frame";

export const generateMetadata = () => placeholderMetadata("about");

// Placeholder until the about page issue (#20) lands.
export default function AboutPage() {
  return <PlaceholderPage page="about" />;
}
