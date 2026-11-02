import { combineSlices, configureStore } from "@reduxjs/toolkit";

import { baseApi } from "./api";

/** UI slices join with `rootReducer.inject(slice)` where they are first used. */
export const rootReducer = combineSlices(baseApi);

/**
 * A new store. Never keep one at module scope: on the server that would share
 * one user's cache with every other request. `StoreProvider` makes one per
 * request on the server and one per page load in the browser.
 */
export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
