import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Use these instead of next/link and next/navigation on public pages: they
// add the locale prefix and only accept the paths listed in routing.ts.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
