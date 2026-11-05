import { can, type UserRole } from "@/lib/auth/permissions";

import { t, type MessageKey } from "./messages";
import { adminModules, type AdminModule, type ModuleSpec, type NavGroup } from "./navigation";

// Kept apart from `./navigation` so client components that need the routes
// do not bundle the permission matrix.

const groups: Array<{ label: MessageKey | null; modules: AdminModule[] }> = [
  { label: null, modules: ["dashboard"] },
  { label: "nav.group.sales", modules: ["apartments", "leads"] },
  { label: "nav.group.content", modules: ["news", "media", "redirects", "seo"] },
  { label: "nav.group.system", modules: ["settings", "users", "audit"] },
];

/** Whether the role may open the module. */
export function canOpen(role: UserRole, module: AdminModule): boolean {
  const spec: ModuleSpec = adminModules[module];
  return spec.permission ? can(role, spec.permission) : true;
}

/**
 * The menu a role sees: only the modules it may open, groups without any
 * left out. Plain data, so the server layout can hand it to the sidebar.
 */
export function buildMenu(role: UserRole): NavGroup[] {
  return groups
    .map((group) => ({
      label: group.label ? t(group.label) : null,
      items: group.modules
        .filter((module) => canOpen(role, module))
        .map((module) => {
          const { href, label } = adminModules[module];
          return { module, href, label: t(label) };
        }),
    }))
    .filter((group) => group.items.length > 0);
}
