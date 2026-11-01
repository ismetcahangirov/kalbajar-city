import { PlaceholderPage, placeholderMetadata } from "@/components/i18n/placeholder-frame";

export const generateMetadata = () => placeholderMetadata("gallery");

// Placeholder until the gallery issue (#21) lands.
export default function GalleryPage() {
  return <PlaceholderPage page="gallery" />;
}
