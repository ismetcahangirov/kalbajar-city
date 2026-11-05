import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/** One tag type per entity; features add endpoints with `injectEndpoints`. */
export const tagTypes = [
  "Apartment",
  "Block",
  "Building",
  "ConstructionUpdate",
  "Faq",
  "Floor",
  "Gallery",
  "HomeSection",
  "LayoutType",
  "Lead",
  "Media",
  "News",
  "Redirect",
  "SeoOverride",
  "Settings",
] as const;

export type TagType = (typeof tagTypes)[number];

/**
 * The single RTK Query API for `/api/v1` (#10). Every client-side data call
 * goes through it; components never call `fetch` for application data.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/v1", credentials: "same-origin" }),
  tagTypes,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});

/** The list's own tag plus one per item, so editing one item refetches the list. */
export function listTags<T extends TagType>(type: T, ids: readonly string[] | undefined) {
  return [{ type, id: "LIST" }, ...(ids ?? []).map((id) => ({ type, id }))];
}
