import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

import { userRoles, type UserRole } from "@/db/schema/auth";

export { userRoles, type UserRole };

/**
 * Every privileged action in the console, by resource. `user` and `session`
 * are Better Auth's admin-plugin statements, so its own endpoints check the
 * same matrix.
 */
export const statements = {
  ...defaultStatements,
  inventory: ["read", "create", "update", "delete"],
  /** Changing an apartment's sale status, which sales may do on its own. */
  apartmentStatus: ["update"],
  content: ["read", "create", "update", "delete", "publish"],
  media: ["read", "upload", "update", "delete"],
  seo: ["read", "update"],
  /**
   * `assign` is seeing every lead and giving it to anyone. Without it a user
   * works only the leads assigned to them or to nobody, and may only take an
   * unassigned one (#26).
   */
  leads: ["read", "update", "assign", "export", "delete"],
  settings: ["read", "update"],
  audit: ["read"],
} as const;

export const accessControl = createAccessControl(statements);

type Statements = typeof statements;

/** A request for one or more actions, e.g. `{ leads: ["read"] }`. */
export type Permission = { [K in keyof Statements]?: Statements[K][number][] };

const everything = {
  // Better Auth's admin statements without impersonation, which nobody gets.
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ] as Statements["user"][number][],
  session: [...statements.session],
  inventory: [...statements.inventory],
  apartmentStatus: [...statements.apartmentStatus],
  content: [...statements.content],
  media: [...statements.media],
  seo: [...statements.seo],
  leads: [...statements.leads],
  settings: [...statements.settings],
  audit: [...statements.audit],
};

/**
 * The matrix from #9. `admin` holds the same statements as `owner`; what it may
 * not do to an owner account is decided per target by `canManageUser`.
 */
export const roles = {
  owner: accessControl.newRole(everything),
  admin: accessControl.newRole(everything),
  editor: accessControl.newRole({
    content: [...statements.content],
    media: [...statements.media],
    seo: [...statements.seo],
  }),
  sales: accessControl.newRole({
    leads: ["read", "update"],
    inventory: ["read"],
    apartmentStatus: ["update"],
  }),
} satisfies Record<UserRole, unknown>;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (userRoles as readonly string[]).includes(value);
}

/** Whether the role may perform every action in `permission`. */
export function can(role: UserRole, permission: Permission): boolean {
  return roles[role].authorize(permission).success;
}

type Account = { id: string; role: UserRole };

/**
 * Whether `actor` may change, deactivate or remove `target`'s account, or give
 * it `nextRole`. Only an owner touches an owner account or makes someone an
 * owner, and nobody demotes or deactivates themselves, so the console can
 * never be left without an owner.
 */
export function canManageUser(actor: Account, target: Account, nextRole?: UserRole): boolean {
  if (!can(actor.role, { user: ["update"] })) return false;
  if (actor.id === target.id) return false;
  if (target.role === "owner" && actor.role !== "owner") return false;
  if (nextRole === "owner" && actor.role !== "owner") return false;
  return true;
}
