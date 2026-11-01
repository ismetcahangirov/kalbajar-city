import { PlaceholderPage, placeholderMetadata } from "@/components/i18n/placeholder-frame";

export const generateMetadata = () => placeholderMetadata("contact");

// Placeholder until the contact page issue (#20) lands.
export default function ContactPage() {
  return <PlaceholderPage page="contact" />;
}
