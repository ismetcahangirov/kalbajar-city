import type { AdminFaq, FaqCreate, FaqUpdate } from "@/shared/faq";
import type {
  AdminGallery,
  AdminGalleryCategory,
  AdminGalleryItem,
  GalleryCategoryCreate,
  GalleryCategoryUpdate,
  GalleryItemCreate,
  GalleryItemUpdate,
} from "@/shared/gallery";

import { baseApi } from "../api";
import { undoOnFailure } from "../optimistic";

const faqList = [{ type: "Faq" as const, id: "LIST" }];
const gallery = [{ type: "Gallery" as const, id: "LIST" }];
/** The library lists gallery items among a file's usages. */
const mediaList = { type: "Media" as const, id: "LIST" };

/** Rows in the order of `ids`; rows `ids` does not name keep their place at the end. */
function inOrder<T extends { id: string }>(rows: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.flatMap((id) => byId.get(id) ?? []);
  return [...ordered, ...rows.filter((row) => !ids.includes(row.id))].map((row, index) => ({
    ...row,
    sortOrder: index,
  }));
}

/**
 * The FAQ and the gallery in the console (#25). Reorders are optimistic, so
 * a drag lands at once; a refused one is undone and the list refetched.
 * The handlers revalidate the public `content` tag on the server.
 */
export const adminFaqGalleryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminFaq: build.query<AdminFaq[], void>({
      query: () => "/admin/faq",
      providesTags: faqList,
    }),
    createFaq: build.mutation<AdminFaq, FaqCreate>({
      query: (body) => ({ url: "/admin/faq", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : faqList),
    }),
    updateFaq: build.mutation<AdminFaq, { id: string } & FaqUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/faq/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, error) => (error ? [] : faqList),
    }),
    deleteFaq: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/faq/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => (error ? [] : faqList),
    }),
    reorderFaq: build.mutation<AdminFaq[], string[]>({
      query: (ids) => ({ url: "/admin/faq/order", method: "PUT", body: { ids } }),
      async onQueryStarted(ids, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminFaqGalleryApi.util.updateQueryData("adminFaq", undefined, (draft) =>
            inOrder(draft, ids),
          ),
        );
        await undoOnFailure(queryFulfilled, [patch]);
      },
      invalidatesTags: faqList,
    }),

    adminGallery: build.query<AdminGallery, void>({
      query: () => "/admin/gallery",
      providesTags: gallery,
    }),
    createGalleryCategory: build.mutation<AdminGalleryCategory, GalleryCategoryCreate>({
      query: (body) => ({ url: "/admin/gallery/categories", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : gallery),
    }),
    updateGalleryCategory: build.mutation<void, { id: string } & GalleryCategoryUpdate>({
      query: ({ id, ...body }) => ({
        url: `/admin/gallery/categories/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, error) => (error ? [] : gallery),
    }),
    deleteGalleryCategory: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/gallery/categories/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => (error ? [] : [...gallery, mediaList]),
    }),
    reorderGalleryCategories: build.mutation<void, string[]>({
      query: (ids) => ({ url: "/admin/gallery/categories/order", method: "PUT", body: { ids } }),
      async onQueryStarted(ids, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminFaqGalleryApi.util.updateQueryData("adminGallery", undefined, (draft) => {
            draft.categories = inOrder(draft.categories, ids);
          }),
        );
        await undoOnFailure(queryFulfilled, [patch]);
      },
      invalidatesTags: gallery,
    }),
    reorderGalleryItems: build.mutation<void, { categoryId: string; ids: string[] }>({
      query: ({ categoryId, ids }) => ({
        url: `/admin/gallery/categories/${categoryId}/items/order`,
        method: "PUT",
        body: { ids },
      }),
      async onQueryStarted({ categoryId, ids }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminFaqGalleryApi.util.updateQueryData("adminGallery", undefined, (draft) => {
            const category = draft.categories.find((candidate) => candidate.id === categoryId);
            if (category) category.items = inOrder(category.items, ids);
          }),
        );
        await undoOnFailure(queryFulfilled, [patch]);
      },
      invalidatesTags: gallery,
    }),
    createGalleryItem: build.mutation<AdminGalleryItem, GalleryItemCreate>({
      query: (body) => ({ url: "/admin/gallery/items", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : [...gallery, mediaList]),
    }),
    updateGalleryItem: build.mutation<AdminGalleryItem, { id: string } & GalleryItemUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/gallery/items/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, error) => (error ? [] : [...gallery, mediaList]),
    }),
    deleteGalleryItem: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/gallery/items/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => (error ? [] : [...gallery, mediaList]),
    }),
  }),
});

export const {
  useAdminFaqQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
  useReorderFaqMutation,
  useAdminGalleryQuery,
  useCreateGalleryCategoryMutation,
  useUpdateGalleryCategoryMutation,
  useDeleteGalleryCategoryMutation,
  useReorderGalleryCategoriesMutation,
  useReorderGalleryItemsMutation,
  useCreateGalleryItemMutation,
  useUpdateGalleryItemMutation,
  useDeleteGalleryItemMutation,
} = adminFaqGalleryApi;
