/**
 * The cookie the shadcn `SidebarProvider` keeps the desktop sidebar's state
 * in, read by the console layout so the first render matches it.
 */
export const sidebarCookie = "sidebar_state";

/** Expanded unless the cookie says the user collapsed it. */
export function sidebarOpenFrom(value: string | undefined): boolean {
  return value !== "false";
}
