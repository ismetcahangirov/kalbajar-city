import type { Page } from "@/shared/api";
import type { AdminAuditEntry, AdminAuditListParams } from "@/shared/audit";

import { baseApi } from "../api";

/** The audit log (#27). Read-only, and any write adds to it, so it has no tag to invalidate. */
export const adminAuditApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminAuditLog: build.query<Page<AdminAuditEntry>, AdminAuditListParams>({
      query: (params) => ({ url: "/admin/audit", params }),
    }),
  }),
});

export const { useAdminAuditLogQuery } = adminAuditApi;
