import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { underlineLinkClass } from "@/components/shell/underline-link";
import { Icon, Picture } from "@/components/ui";
import { mapAppLinks, osmEmbedUrl, type LatLng, type MapApp } from "@/lib/maps";
import type { PublicImage } from "@/lib/public/media";

import { InteractiveMap } from "./interactive-map";

const apps: MapApp[] = ["google", "apple", "waze"];

/**
 * The map of the complex: the static map image with a button that loads the
 * interactive map, and links that open the point in Google Maps, Apple Maps
 * or Waze. Shown on the location and contact pages, and only when the owner
 * has confirmed the coordinates (#7): without them there is no map at all.
 */
export async function MapBlock({
  coordinates,
  image,
}: {
  coordinates: LatLng | null;
  image: PublicImage | null;
}) {
  if (!coordinates) return null;
  const t = await getTranslations("Map");
  const links = mapAppLinks(coordinates, t("pin"));
  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-grid overflow-hidden rounded-md border border-border bg-surface-raised">
        <InteractiveMap src={osmEmbedUrl(coordinates)} title={t("frameTitle")} label={t("show")}>
          {image && <Picture image={image} sizes="(min-width: 64rem) 50vw, 100vw" />}
        </InteractiveMap>
      </div>
      <ul aria-label={t("apps")} className="flex flex-wrap gap-x-6">
        {apps.map((app) => (
          <li key={app}>
            <a
              href={links[app]}
              target="_blank"
              rel="noopener noreferrer"
              className={underlineLinkClass()}
            >
              {t(`open.${app}`)}
              <Icon icon={ArrowUpRight} />
              <span className="sr-only">{t("newTab")}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
