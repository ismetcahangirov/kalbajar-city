import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

import type { Page } from "@/shared/api";
import type {
  AdminMedia,
  AdminMediaDetail,
  MediaCreate,
  MediaListParams,
  MediaUpdate,
  UploadTicket,
} from "@/shared/media";

import { baseApi, listTags } from "../api";

/** What `uploadMedia` takes: the file, and everything `POST /admin/media` takes but its key. */
export type MediaUploadArgs = { file: File } & Omit<MediaCreate, "key">;

/**
 * The console's media library (#25). Writes invalidate the item and every
 * list; the handlers revalidate the public pages' `media` tag on the server.
 */
export const adminMediaApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminMediaList: build.query<Page<AdminMedia>, MediaListParams | void>({
      query: (params) => ({ url: "/admin/media", params: params ?? undefined }),
      providesTags: (result) =>
        listTags(
          "Media",
          result?.items.map((item) => item.id),
        ),
    }),
    adminMedia: build.query<AdminMediaDetail, string>({
      query: (id) => `/admin/media/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Media", id }],
    }),
    /**
     * The whole upload: a presigned PUT from the server, the file straight to
     * the bucket, then processing. The middle step goes to the bucket's origin,
     * outside `/api/v1`, which is why this is a `queryFn`.
     */
    uploadMedia: build.mutation<AdminMedia, MediaUploadArgs>({
      async queryFn({ file, ...fields }, _api, _options, baseQuery) {
        const ticket = await baseQuery({
          url: "/admin/media/uploads",
          method: "POST",
          body: { filename: file.name, mimeType: file.type, size: file.size },
        });
        if (ticket.error) return { error: ticket.error };
        const { key, url, method, headers } = ticket.data as UploadTicket;

        try {
          const sent = await fetch(url, { method, headers, body: file });
          if (!sent.ok) return { error: { status: sent.status, data: null } };
        } catch (error) {
          return { error: { status: "FETCH_ERROR", error: String(error) } as FetchBaseQueryError };
        }

        const created = await baseQuery({
          url: "/admin/media",
          method: "POST",
          body: { ...fields, key },
        });
        return created.error ? { error: created.error } : { data: created.data as AdminMedia };
      },
      invalidatesTags: (_result, error) => (error ? [] : [{ type: "Media", id: "LIST" }]),
    }),
    updateMedia: build.mutation<AdminMedia, { id: string } & MediaUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/media/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, error, { id }) =>
        error
          ? []
          : [
              { type: "Media", id },
              { type: "Media", id: "LIST" },
            ],
    }),
    /** A file in use answers 409 `MEDIA_IN_USE`; its `usages` are in the error body. */
    deleteMedia: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/media/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error, id) =>
        error
          ? []
          : [
              { type: "Media", id },
              { type: "Media", id: "LIST" },
            ],
    }),
  }),
});

export const {
  useAdminMediaListQuery,
  useAdminMediaQuery,
  useUploadMediaMutation,
  useUpdateMediaMutation,
  useDeleteMediaMutation,
} = adminMediaApi;
