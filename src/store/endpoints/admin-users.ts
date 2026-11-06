import type {
  AdminInvitation,
  AdminUser,
  InvitationCreate,
  InvitationSent,
  SetRole,
} from "@/shared/users";

import { baseApi, listTags } from "../api";

const invalidatesUsers = (_result: unknown, error: unknown) =>
  // A demoted or deactivated inviter's invitations are revoked with them.
  error
    ? []
    : [
        { type: "User" as const, id: "LIST" },
        { type: "Invitation" as const, id: "LIST" },
      ];

const invalidatesInvitations = (_result: unknown, error: unknown) =>
  error ? [] : [{ type: "Invitation" as const, id: "LIST" }];

/** The console's users and invitations (#27). Nothing here is on a public page. */
export const adminUsersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminUsers: build.query<AdminUser[], void>({
      query: () => "/admin/users",
      providesTags: (result) =>
        listTags(
          "User",
          result?.map((item) => item.id),
        ),
    }),
    setUserRole: build.mutation<AdminUser, { id: string } & SetRole>({
      query: ({ id, ...body }) => ({ url: `/admin/users/${id}/role`, method: "PUT", body }),
      invalidatesTags: invalidatesUsers,
    }),
    deactivateUser: build.mutation<AdminUser, string>({
      query: (id) => ({ url: `/admin/users/${id}/deactivate`, method: "POST" }),
      invalidatesTags: invalidatesUsers,
    }),
    reactivateUser: build.mutation<AdminUser, string>({
      query: (id) => ({ url: `/admin/users/${id}/reactivate`, method: "POST" }),
      invalidatesTags: invalidatesUsers,
    }),
    adminInvitations: build.query<AdminInvitation[], void>({
      query: () => "/admin/invitations",
      providesTags: (result) =>
        listTags(
          "Invitation",
          result?.map((item) => item.id),
        ),
    }),
    createInvitation: build.mutation<InvitationSent, InvitationCreate>({
      query: (body) => ({ url: "/admin/invitations", method: "POST", body }),
      invalidatesTags: invalidatesInvitations,
    }),
    resendInvitation: build.mutation<InvitationSent, string>({
      query: (id) => ({ url: `/admin/invitations/${id}/resend`, method: "POST" }),
      invalidatesTags: invalidatesInvitations,
    }),
    revokeInvitation: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/invitations/${id}`, method: "DELETE" }),
      invalidatesTags: invalidatesInvitations,
    }),
    acceptInvitation: build.mutation<
      { accepted: true },
      { token: string; name: string; password: string; confirm: string }
    >({
      query: (body) => ({ url: "/invitations/accept", method: "POST", body }),
    }),
  }),
});

export const {
  useAdminUsersQuery,
  useSetUserRoleMutation,
  useDeactivateUserMutation,
  useReactivateUserMutation,
  useAdminInvitationsQuery,
  useCreateInvitationMutation,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
  useAcceptInvitationMutation,
} = adminUsersApi;
