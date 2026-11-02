"use client";

import {
  Building2,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  Newspaper,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/admin/ui/sidebar";
import { t } from "@/lib/admin/messages";
import { isCurrent, type AdminModule, type NavGroup } from "@/lib/admin/navigation";
import { authClient } from "@/lib/auth/client";
import { adminPaths } from "@/lib/auth/paths";

const icons: Record<AdminModule, LucideIcon> = {
  dashboard: LayoutDashboard,
  apartments: Building2,
  leads: Inbox,
  news: Newspaper,
  media: Images,
  settings: Settings,
  users: Users,
  audit: ScrollText,
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("az"))
    .join("");
}

/**
 * The console's navigation: shadcn's Sidebar, an icon rail when collapsed on
 * desktop and an off-canvas sheet below `md`. `menu` is already filtered by
 * the user's role on the server (`buildMenu`).
 */
export function AppSidebar({
  menu,
  user,
}: {
  menu: NavGroup[];
  user: { name: string; role: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [signingOut, setSigningOut] = useState(false);

  // The sheet would stay open over the next page unless a link closes it.
  const closeSheet = () => {
    if (isMobile) setOpenMobile(false);
  };

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace(adminPaths.login);
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={t("brand")}>
              <Link href={adminPaths.home} onClick={closeSheet}>
                <span
                  aria-hidden
                  className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-md font-medium"
                >
                  K
                </span>
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{t("brand")}</span>
                  <span className="text-xs text-muted-foreground truncate">{t("panel.title")}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {menu.map((group, index) => (
          <SidebarGroup key={group.label ?? index}>
            {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = icons[item.module];
                  const current = isCurrent(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.module}>
                      <SidebarMenuButton asChild isActive={current} tooltip={item.label}>
                        <Link
                          href={item.href}
                          aria-current={current ? "page" : undefined}
                          onClick={closeSheet}
                        >
                          <Icon aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <div
              data-testid="sidebar-user"
              className="text-sm flex items-center gap-2 p-2 group-data-[collapsible=icon]:p-0"
            >
              <span
                aria-hidden
                className="border-sidebar-border bg-sidebar-accent text-xs flex size-8 shrink-0 items-center justify-center rounded-full border font-medium"
              >
                {initials(user.name)}
              </span>
              <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:sr-only">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground truncate">{user.role}</span>
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              tooltip={t("panel.signOut")}
              onClick={signOut}
              disabled={signingOut}
            >
              <LogOut aria-hidden />
              <span>{t("panel.signOut")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
