import { useSyncExternalStore } from "react";

/** Tailwind's `md`: below it the sidebar is an off-canvas sheet. */
const query = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(query);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** Whether the viewport is below `md`; `false` on the server. */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
