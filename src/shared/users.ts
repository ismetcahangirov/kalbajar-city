import { z } from "zod";

import type { UserRole } from "@/db/schema/auth";

import { newPasswordSchema } from "./auth";

/*
 * Console users and invitations (#27). The endpoints parse with these schemas
 * and the console's forms validate with the same ones. Refinement messages are
 * console catalogue keys (`@/lib/admin/messages`).
 */

/** The same values as the database enum, without bundling the schema into forms. */
export const roleValues = [
  "owner",
  "admin",
  "editor",
  "sales",
] as const satisfies readonly UserRole[];

export const invitationLifetimeDays = 7;

const role = z.enum(roleValues);

export const invitationCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "error.required")
    .pipe(z.email("error.email"))
    .transform((value) => value.toLowerCase()),
  role,
});

export type InvitationCreate = z.input<typeof invitationCreateSchema>;

export const setRoleSchema = z.object({ role });

export type SetRole = z.input<typeof setRoleSchema>;

export const userIdParamsSchema = z.object({ id: z.string().min(1).max(64) });

export const invitationIdParamsSchema = z.object({ id: z.uuid() });

/** What the invited person fills in. */
export const acceptFormSchema = newPasswordSchema.and(
  z.object({ name: z.string().trim().min(2, "invite.error.name").max(120, "invite.error.name") }),
);

export const invitationAcceptSchema = acceptFormSchema.and(
  z.object({ token: z.string().min(1).max(128) }),
);

export type InvitationAccept = z.output<typeof invitationAcceptSchema>;

/** A console account as the users screen lists it. */
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  /** The account the list was asked for by. */
  self: boolean;
  /** Whether the asking user may change this account. */
  manageable: boolean;
};

/** A pending invitation, expired or not. Its token is never sent to anyone but the invitee. */
export type AdminInvitation = {
  id: string;
  email: string;
  role: UserRole;
  invitedByName: string | null;
  expiresAt: string;
  expired: boolean;
  manageable: boolean;
};

export type InvitationSent = {
  invitation: AdminInvitation;
  /** `false` when the invitation stands but the e-mail could not be sent. */
  mailSent: boolean;
};
