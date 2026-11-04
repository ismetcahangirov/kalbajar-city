import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { underlineLinkClass } from "@/components/shell/underline-link";
import { Icon } from "@/components/ui/icon";
import { Picture } from "@/components/ui/picture";
import { mapAppLinks, osmEmbedUrl, type LatLng, type MapApp } from "@/lib/maps";
import type { PublicImage } from "@/lib/public/media";

import { InteractiveMap } from "./interactive-map";

const apps: MapApp[] = ["google", "apple", "waze"];

/**
 * The map of the complex in the reference's illustrated style (pyzhevsky-
 * pages.md §3 `/contacts`): a cream ground in a hairline frame with the
 * taupe pin and its ink flag, or the owner's static map image, and a button
 * that loads the interactive map; links open the point in Google Maps,
 * Apple Maps or Waze. The ground is drawn, not a map: it shows no streets,
 * so it cannot be read as one. Shown on the location and contact pages, and
 * only when the owner has confirmed the coordinates (#7).
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
    <div className="flex flex-col gap-u">
      <div
        data-theme="light"
        className="relative isolate aspect-[3/4] overflow-hidden border border-(--t-line) bg-(--t-bg) text-(--t-text) sm:aspect-[16/9] lg:aspect-[21/9]"
      >
        <InteractiveMap src={osmEmbedUrl(coordinates)} title={t("frameTitle")} label={t("show")}>
          {image ? (
            <Picture image={image} sizes="100vw" />
          ) : (
            <div aria-hidden className="absolute inset-0 flex items-center justify-center">
              {/* Thin rules through the point, as the ground's only drawing. */}
              <span className="absolute inset-y-0 start-1/2 w-px bg-(--t-line)" />
              <span className="absolute inset-x-0 top-1/2 h-px bg-(--t-line)" />
              <span className="relative flex flex-col items-center gap-u">
                <span className="bg-ink px-u py-[0.375rem] text-label text-cream uppercase">
                  {t("pin")}
                </span>
                <span className="grid size-[1.875rem] place-items-center rounded-full bg-taupe">
                  <span className="size-[0.375rem] rounded-full bg-cream" />
                </span>
              </span>
            </div>
          )}
        </InteractiveMap>
      </div>
      <ul aria-label={t("apps")} className="flex flex-wrap gap-x-u2">
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
