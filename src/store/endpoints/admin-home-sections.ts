import type {
  AdminHomeSection,
  HomeSectionContentByKey,
  HomeSectionKey,
  HomeSectionOrder,
} from "@/shared/home-sections";

import { baseApi, listTags } from "../api";
import { undoOnFailure } from "../optimistic";

/** A section's save: its key and its whole new content. */
export type HomeSectionUpdate = {
  [K in HomeSectionKey]: { key: K; content: HomeSectionContentByKey[K] };
}[HomeSectionKey];

const placeholders = { type: "Settings", id: "placeholders" } as const;

/**
 * The home sections screen (#17). Order and visibility are optimistic, so a
 * move lands at once; a refused one is undone and the list refetched. The
 * handlers revalidate the public `content` tag on the server.
 */
export const adminHomeSectionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminHomeSections: build.query<AdminHomeSection[], void>({
      query: () => "/admin/home-sections",
      providesTags: (sections) =>
        listTags(
          "HomeSection",
          sections?.map((section) => section.key),
        ),
    }),
    updateHomeSection: build.mutation<AdminHomeSection, HomeSectionUpdate>({
      query: ({ key, content }) => ({
        url: `/admin/home-sections/${key}`,
        method: "PUT",
        body: content,
      }),
      invalidatesTags: (_result, error, { key }) =>
        error ? [] : [{ type: "HomeSection", id: key }, placeholders],
    }),
    saveHomeSectionOrder: build.mutation<AdminHomeSection[], HomeSectionOrder["sections"]>({
      query: (sections) => ({
        url: "/admin/home-sections/order",
        method: "PUT",
        body: { sections },
      }),
      async onQueryStarted(sections, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminHomeSectionsApi.util.updateQueryData("adminHomeSections", undefined, (draft) =>
            sections.flatMap(({ key, visible }, sortOrder) => {
              const section = draft.find((candidate) => candidate.key === key);
              return section ? [{ ...section, visible, sortOrder }] : [];
            }),
          ),
        );
        await undoOnFailure(queryFulfilled, [patch]);
      },
      invalidatesTags: [{ type: "HomeSection", id: "LIST" }],
    }),
  }),
});

export const {
  useAdminHomeSectionsQuery,
  useUpdateHomeSectionMutation,
  useSaveHomeSectionOrderMutation,
} = adminHomeSectionsApi;
