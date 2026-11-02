import type { Page } from "@/shared/api";
import type {
  AdminMedia,
  AdminMediaDetail,
  MediaCreate,
  MediaListParams,
  MediaUpdate,
  UploadRequest,
  UploadTicket,
} from "@/shared/media";

import { baseApi, listTags } from "../api";

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
     * Step one of an upload: a presigned PUT. The file then goes straight to
     * the bucket (`putFile` in `@/lib/admin/upload`, for its progress events),
     * and step two is `createMedia`.
     */
    requestMediaUpload: build.mutation<UploadTicket, UploadRequest>({
      query: (body) => ({ url: "/admin/media/uploads", method: "POST", body }),
    }),
    /** Step two: the server checks and processes the uploaded file. */
    createMedia: build.mutation<AdminMedia, MediaCreate>({
      query: (body) => ({ url: "/admin/media", method: "POST", body }),
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
  useRequestMediaUploadMutation,
  useCreateMediaMutation,
  useUpdateMediaMutation,
  useDeleteMediaMutation,
} = adminMediaApi;
