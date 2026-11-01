import type { formats } from "./format";
import type messages from "./messages/az.json";
import type { routing } from "./routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
    Formats: typeof formats;
  }
}
