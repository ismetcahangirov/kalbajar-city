import type { Page } from "@/shared/api";
import type {
  AdminLead,
  AdminLeadDetail,
  AdminLeadListParams,
  LeadNote,
  LeadNoteInput,
  LeadSummary,
  LeadUpdate,
} from "@/shared/leads";
import type { SettingsValue } from "@/shared/settings";

import { baseApi, listTags } from "../api";
import { undoOnFailure } from "../optimistic";

/**
 * The console's leads (#26). Every write invalidates the lead and the lists,
 * so open views, the sidebar's count of new leads included, refetch. Leads
 * are not on public pages, so no server tag is revalidated.
 */
export const adminLeadsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminLeads: build.query<Page<AdminLead>, AdminLeadListParams | void>({
      query: (params) => ({ url: "/admin/leads", params: params ?? undefined }),
      providesTags: (result) =>
        listTags(
          "Lead",
          result?.items.map((item) => item.id),
        ),
    }),
    adminLead: build.query<AdminLeadDetail, string>({
      query: (id) => `/admin/leads/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Lead", id }],
    }),
    adminLeadSummary: build.query<LeadSummary, void>({
      query: () => "/admin/leads/summary",
      providesTags: [{ type: "Lead", id: "LIST" }],
    }),
    updateLead: build.mutation<AdminLeadDetail, { id: string } & LeadUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}`, method: "PATCH", body }),
      // A status change shows at once in the lead and every cached list, and
      // is undone if the server refuses it; the answer then settles the lead.
      async onQueryStarted({ id, status }, { dispatch, getState, queryFulfilled }) {
        const { util } = adminLeadsApi;
        const patches =
          status === undefined
            ? []
            : [
                dispatch(
                  util.updateQueryData("adminLead", id, (draft) => {
                    draft.status = status;
                  }),
                ),
                ...util.selectCachedArgsForQuery(getState(), "adminLeads").map((args) =>
                  dispatch(
                    util.updateQueryData("adminLeads", args, (draft) => {
                      const item = draft.items.find((entry) => entry.id === id);
                      if (item) item.status = status;
                    }),
                  ),
                ),
              ];
        await undoOnFailure(queryFulfilled, patches);
        try {
          const { data } = await queryFulfilled;
          dispatch(util.upsertQueryData("adminLead", id, data));
        } catch {
          // The patches are undone above; the form shows the error.
        }
      },
      invalidatesTags: (_result, error) => (error ? [] : [{ type: "Lead", id: "LIST" }]),
    }),
    addLeadNote: build.mutation<LeadNote, { id: string } & LeadNoteInput>({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}/notes`, method: "POST", body }),
      invalidatesTags: (_result, error, { id }) =>
        error
          ? []
          : [
              { type: "Lead", id },
              { type: "Lead", id: "LIST" },
            ],
    }),
    leadSettings: build.query<SettingsValue<"leads">, void>({
      query: () => "/admin/leads/settings",
      providesTags: [{ type: "Settings", id: "leads" }],
    }),
    updateLeadSettings: build.mutation<SettingsValue<"leads">, SettingsValue<"leads">>({
      query: (body) => ({ url: "/admin/leads/settings", method: "PUT", body }),
      invalidatesTags: (_result, error) => (error ? [] : [{ type: "Settings", id: "leads" }]),
    }),
  }),
});

export const {
  useAdminLeadsQuery,
  useAdminLeadQuery,
  useAdminLeadSummaryQuery,
  useUpdateLeadMutation,
  useAddLeadNoteMutation,
  useLeadSettingsQuery,
  useUpdateLeadSettingsMutation,
} = adminLeadsApi;
