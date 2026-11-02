import type { LeadCreated, LeadSubmission } from "@/shared/leads";

import { baseApi } from "../api";

/** The public lead forms (#22). */
export const leadsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    submitLead: build.mutation<LeadCreated, LeadSubmission>({
      query: (body) => ({ url: "/leads", method: "POST", body }),
      // The console's lead list, when it is open in this browser.
      invalidatesTags: (_result, error) => (error ? [] : [{ type: "Lead", id: "LIST" }]),
    }),
  }),
});

export const { useSubmitLeadMutation } = leadsApi;
