"use client";

import { setupListeners } from "@reduxjs/toolkit/query";
import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";

import { makeStore } from ".";

/**
 * Gives its subtree a store of its own. The console mounts it once in its
 * layout. Public pages do not, so routes without client-side data ship no
 * Redux: an interactive island (catalogue filters, a lead form) wraps itself.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);
  // Refetch on reconnect (see `baseApi`); the returned function unsubscribes.
  useEffect(() => setupListeners(store.dispatch), [store]);
  return <Provider store={store}>{children}</Provider>;
}
