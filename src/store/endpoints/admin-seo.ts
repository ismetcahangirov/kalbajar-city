import type { AdminSeoOverride, SeoOverrideCreate, SeoPage } from "@/shared/seo-overrides";

import { baseApi, listTags } from "../api";

/**
 * The console's SEO overrides (#27). The server revalidates the `settings`
 * cache tag on every write, so the public page shows the change on its next
 * request; here every write refetches the list.
 */
export const adminSeoApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminSeoOverrides: build.query<AdminSeoOverride[], void>({
      query: () => "/admin/seo-overrides",
      providesTags: (result) =>
        listTags(
          "SeoOverride",
          result?.map((item) => item.id),
        ),
    }),
    adminSeoPages: build.query<SeoPage[], void>({
      query: () => "/admin/seo-overrides/pages",
      // The suggestions list every apartment and article, so it follows their edits.
      providesTags: [
        { type: "Apartment", id: "LIST" },
        { type: "News", id: "LIST" },
      ],
    }),
    createSeoOverride: build.mutation<AdminSeoOverride, SeoOverrideCreate>({
      query: (body) => ({ url: "/admin/seo-overrides", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : [{ type: "SeoOverride", id: "LIST" }]),
    }),
    updateSeoOverride: build.mutation<AdminSeoOverride, { id: string } & SeoOverrideCreate>({
      query: ({ id, ...body }) => ({ url: `/admin/seo-overrides/${id}`, method: "PUT", body }),
      invalidatesTags: (_result, error, { id }) =>
        error
          ? []
          : [
              { type: "SeoOverride", id },
              { type: "SeoOverride", id: "LIST" },
            ],
    }),
    deleteSeoOverride: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/seo-overrides/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error, id) =>
        error
          ? []
          : [
              { type: "SeoOverride", id },
              { type: "SeoOverride", id: "LIST" },
            ],
    }),
  }),
});

export const {
  useAdminSeoOverridesQuery,
  useAdminSeoPagesQuery,
  useCreateSeoOverrideMutation,
  useUpdateSeoOverrideMutation,
  useDeleteSeoOverrideMutation,
} = adminSeoApi;
