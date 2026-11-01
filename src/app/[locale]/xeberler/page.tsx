import { PlaceholderPage, placeholderMetadata } from "@/components/i18n/placeholder-frame";

export const generateMetadata = () => placeholderMetadata("news");

// Placeholder until the news issue (#21) lands.
export default function NewsPage() {
  return <PlaceholderPage page="news" />;
}
