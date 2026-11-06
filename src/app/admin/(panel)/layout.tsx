import { cookies } from "next/headers";

import { ConfirmProvider } from "@/components/admin/feedback/confirm";
import { AppSidebar } from "@/components/admin/shell/app-sidebar";
import { SkipLink } from "@/components/admin/shell/skip-link";
import { TopBar } from "@/components/admin/shell/top-bar";
import { sidebarCookie, sidebarOpenFrom } from "@/components/admin/sidebar-cookie";
import { SidebarInset, SidebarProvider } from "@/components/admin/ui/sidebar";
import { Toaster } from "@/components/admin/ui/sonner";
import { buildMenu } from "@/lib/admin/menu";
import { roleLabel } from "@/lib/admin/messages";
import { requireUser } from "@/lib/auth/session";

// Every console page depends on the session; it renders per request and is
// sent complete (CLAUDE.md → Data and state).
export const instant = false;

/**
 * The console shell (#23): the role-aware sidebar, the top bar with the
 * sidebar toggle and breadcrumbs, toasts and the confirm dialog. Pages only
 * render their content; `StoreProvider` is in the console's root layout.
 */
export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser();
  // Matches the first render to the state the sidebar saved last time.
  const open = sidebarOpenFrom((await cookies()).get(sidebarCookie)?.value);

  return (
    <SidebarProvider defaultOpen={open}>
      <SkipLink />
      <ConfirmProvider>
        <AppSidebar
          menu={buildMenu(user.role)}
          user={{ name: user.name, role: roleLabel(user.role) }}
        />
        {/* min-w-0: a wide table scrolls in its own box, not the whole page. */}
        <SidebarInset className="min-w-0">
          <TopBar />
          <div
            id="content"
            tabIndex={-1}
            className="flex min-w-0 flex-1 flex-col gap-6 p-4 outline-none md:p-6"
          >
            {children}
          </div>
        </SidebarInset>
      </ConfirmProvider>
      <Toaster position="top-center" />
    </SidebarProvider>
  );
}
