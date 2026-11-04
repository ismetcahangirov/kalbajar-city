import type { Locale } from "@/i18n/routing";
import type { HomeSection } from "@/lib/public/home";

import { About } from "./about";
import { Amenities } from "./amenities";
import { CardZoom } from "./card-zoom";
import { Construction } from "./construction";
import { Cta } from "./cta";
import { Faq } from "./faq";
import { Hero } from "./hero";
import { Layouts } from "./layouts";
import { Location } from "./location";
import { Process } from "./process";
import { Stats } from "./stats";

/**
 * One home section as its reference scene (spec §7.2). The console's order
 * decides where each one stands; each scene brings its own theme, so the
 * order needs no alternating surfaces.
 */
export function HomeScene({ section, locale }: { section: HomeSection; locale: Locale }) {
  switch (section.kind) {
    case "hero":
      return <Hero {...section} />;
    case "about":
      return <About {...section} locale={locale} />;
    case "stats":
      return <Stats {...section} />;
    case "layouts":
      return <Layouts {...section} />;
    case "card_zoom":
      return <CardZoom {...section} locale={locale} />;
    case "amenities":
      return <Amenities {...section} locale={locale} />;
    case "location":
      return <Location {...section} locale={locale} />;
    case "construction":
      return <Construction {...section} locale={locale} />;
    case "process":
      return <Process {...section} locale={locale} />;
    case "faq":
      return <Faq {...section} />;
    case "cta":
      return <Cta {...section} locale={locale} />;
  }
}
