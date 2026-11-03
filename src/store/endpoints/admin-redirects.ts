import type { AdminRedirect, RedirectCreate } from "@/shared/redirects";

import { baseApi, listTags } from "../api";

/**
 * The console's redirects (#27). A save can change other redirects too (a
 * resolved chain), so every write invalidates the whole list. No server
 * `cacheTag` is involved: the proxy reloads the table on its own.
 */
export const adminRedirectsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminRedirects: build.query<AdminRedirect[], void>({
      query: () => "/admin/redirects",
      providesTags: (result) =>
        listTags(
          "Redirect",
          result?.map((item) => item.id),
        ),
    }),
    createRedirect: build.mutation<AdminRedirect, RedirectCreate>({
      query: (body) => ({ url: "/admin/redirects", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : [{ type: "Redirect", id: "LIST" }]),
    }),
    updateRedirect: build.mutation<AdminRedirect, { id: string } & RedirectCreate>({
      query: ({ id, ...body }) => ({ url: `/admin/redirects/${id}`, method: "PUT", body }),
      invalidatesTags: (_result, error) => (error ? [] : [{ type: "Redirect", id: "LIST" }]),
    }),
    deleteRedirect: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/redirects/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error, id) =>
        error
          ? []
          : [
              { type: "Redirect", id },
              { type: "Redirect", id: "LIST" },
            ],
    }),
  }),
});

export const {
  useAdminRedirectsQuery,
  useCreateRedirectMutation,
  useUpdateRedirectMutation,
  useDeleteRedirectMutation,
} = adminRedirectsApi;
