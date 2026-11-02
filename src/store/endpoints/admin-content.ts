import type { Page } from "@/shared/api";
import type {
  AdminConstructionUpdate,
  AdminNews,
  ConstructionUpdateCreate,
  ConstructionUpdateUpdate,
  ContentListParams,
  NewsCreate,
  NewsUpdate,
  Publication,
} from "@/shared/content";

import { baseApi, listTags } from "../api";

const changed = <T extends "ConstructionUpdate" | "News">(type: T, id: string) => [
  { type, id },
  { type, id: "LIST" },
];

/**
 * Construction updates and news for the console's content module (#25).
 * Writes invalidate the item and every list; the handlers revalidate the
 * public pages' `content` tag on the server.
 */
export const adminContentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminConstructionUpdates: build.query<Page<AdminConstructionUpdate>, ContentListParams | void>({
      query: (params) => ({ url: "/admin/construction-updates", params: params ?? undefined }),
      providesTags: (result) =>
        listTags(
          "ConstructionUpdate",
          result?.items.map((item) => item.id),
        ),
    }),
    adminConstructionUpdate: build.query<AdminConstructionUpdate, string>({
      query: (id) => `/admin/construction-updates/${id}`,
      providesTags: (_result, _error, id) => [{ type: "ConstructionUpdate", id }],
    }),
    createConstructionUpdate: build.mutation<AdminConstructionUpdate, ConstructionUpdateCreate>({
      query: (body) => ({ url: "/admin/construction-updates", method: "POST", body }),
      invalidatesTags: (_result, error) =>
        error ? [] : [{ type: "ConstructionUpdate", id: "LIST" }],
    }),
    updateConstructionUpdate: build.mutation<
      AdminConstructionUpdate,
      { id: string } & ConstructionUpdateUpdate
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/construction-updates/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, error, { id }) => (error ? [] : changed("ConstructionUpdate", id)),
    }),
    /** The whole ordered list of photos and video. */
    setConstructionUpdateMedia: build.mutation<
      AdminConstructionUpdate,
      { id: string; mediaIds: string[] }
    >({
      query: ({ id, mediaIds }) => ({
        url: `/admin/construction-updates/${id}/media`,
        method: "PUT",
        body: { mediaIds },
      }),
      // The library's usages of these files change too.
      invalidatesTags: (_result, error, { id }) =>
        error ? [] : [...changed("ConstructionUpdate", id), { type: "Media", id: "LIST" }],
    }),
    publishConstructionUpdate: build.mutation<
      AdminConstructionUpdate,
      { id: string; publish: boolean } & Publication
    >({
      query: ({ id, publish, ...body }) => ({
        url: `/admin/construction-updates/${id}/publication`,
        method: publish ? "PUT" : "DELETE",
        body: publish ? body : undefined,
      }),
      invalidatesTags: (_result, error, { id }) => (error ? [] : changed("ConstructionUpdate", id)),
    }),
    deleteConstructionUpdate: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/construction-updates/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error, id) =>
        error ? [] : [...changed("ConstructionUpdate", id), { type: "Media", id: "LIST" }],
    }),

    adminNewsList: build.query<Page<AdminNews>, ContentListParams | void>({
      query: (params) => ({ url: "/admin/news", params: params ?? undefined }),
      providesTags: (result) =>
        listTags(
          "News",
          result?.items.map((item) => item.id),
        ),
    }),
    adminNews: build.query<AdminNews, string>({
      query: (id) => `/admin/news/${id}`,
      providesTags: (_result, _error, id) => [{ type: "News", id }],
    }),
    createNews: build.mutation<AdminNews, NewsCreate>({
      query: (body) => ({ url: "/admin/news", method: "POST", body }),
      invalidatesTags: (_result, error) =>
        error
          ? []
          : [
              { type: "News", id: "LIST" },
              { type: "Media", id: "LIST" },
            ],
    }),
    updateNews: build.mutation<AdminNews, { id: string } & NewsUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/news/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, error, { id }) =>
        error ? [] : [...changed("News", id), { type: "Media", id: "LIST" }],
    }),
    publishNews: build.mutation<AdminNews, { id: string; publish: boolean } & Publication>({
      query: ({ id, publish, ...body }) => ({
        url: `/admin/news/${id}/publication`,
        method: publish ? "PUT" : "DELETE",
        body: publish ? body : undefined,
      }),
      invalidatesTags: (_result, error, { id }) => (error ? [] : changed("News", id)),
    }),
    deleteNews: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/news/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error, id) =>
        error ? [] : [...changed("News", id), { type: "Media", id: "LIST" }],
    }),
  }),
});

export const {
  useAdminConstructionUpdatesQuery,
  useAdminConstructionUpdateQuery,
  useCreateConstructionUpdateMutation,
  useUpdateConstructionUpdateMutation,
  useSetConstructionUpdateMediaMutation,
  usePublishConstructionUpdateMutation,
  useDeleteConstructionUpdateMutation,
  useAdminNewsListQuery,
  useAdminNewsQuery,
  useCreateNewsMutation,
  useUpdateNewsMutation,
  usePublishNewsMutation,
  useDeleteNewsMutation,
} = adminContentApi;
