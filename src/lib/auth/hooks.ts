import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { users, verifications } from "@/db/schema";
import { audit } from "@/lib/audit";
import { t } from "@/lib/admin/messages";

import { canManageUser, isUserRole, type UserRole } from "./permissions";
import { clearFailures, lockedUntil, lockMinutes, normalizeEmail, recordFailure } from "./throttle";

type Ctx = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];
type Row = Record<string, unknown>;
type Actor = { id: string; role: UserRole };

/** What the before hook learns for the after hook, kept on the endpoint context. */
type Pending = { actorId: string | null; targetId?: string; before?: Row | null };
const pendingKey = "kalbajarAudit";

function pending(ctx: Ctx): Pending | undefined {
  return (ctx.context as unknown as Record<string, Pending | undefined>)[pendingKey];
}

function setPending(ctx: Ctx, value: Pending) {
  // A plain property survives the merge Better Auth applies to the context
  // between the before and after hooks.
  (ctx.context as unknown as Record<string, Pending>)[pendingKey] = value;
}

function body(ctx: Ctx): Row {
  return ctx.body && typeof ctx.body === "object" ? (ctx.body as Row) : {};
}

const str = (value: unknown) => (typeof value === "string" ? value : undefined);

async function loadUser(db: Executor, id: string): Promise<Row | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      image: users.image,
      role: users.role,
      banned: users.banned,
      banReason: users.banReason,
      banExpires: users.banExpires,
    })
    .from(users)
    .where(eq(users.id, id));
  return row ?? null;
}

async function actorOf(ctx: Ctx): Promise<Actor | null> {
  const session = await getSessionFromCtx(ctx);
  const role: unknown = session?.user.role;
  return session && isUserRole(role) ? { id: session.user.id, role } : null;
}

async function resetTokenOwner(db: Executor, token: unknown): Promise<string | undefined> {
  if (typeof token !== "string") return undefined;
  const [row] = await db
    .select({ value: verifications.value })
    .from(verifications)
    .where(eq(verifications.identifier, `reset-password:${token}`));
  return row?.value;
}

type Rule = {
  action: string;
  /** The account the endpoint changes. */
  target: (ctx: Ctx, db: Executor, actor: Actor | null) => Promise<string | undefined>;
  /** Record the changed fields, not only that the action happened. */
  diff?: boolean;
};

const self: Rule["target"] = async (_ctx, _db, actor) => actor?.id;
const bodyUser: Rule["target"] = async (ctx) => str(body(ctx).userId);

/** Better Auth endpoints that write to an account, and how each is logged. */
const audited: Record<string, Rule> = {
  "/update-user": { action: "user.update", target: self, diff: true },
  "/change-password": { action: "user.password_change", target: self },
  "/reset-password": {
    action: "user.password_reset",
    target: (ctx, db) => resetTokenOwner(db, body(ctx).token),
  },
  "/admin/create-user": { action: "user.create", target: async () => undefined, diff: true },
  "/admin/set-user-password": { action: "user.password_set", target: bodyUser },
  "/admin/revoke-user-sessions": { action: "user.sessions_revoke", target: bodyUser },
};

/** Admin endpoints that act on another account, so `canManageUser` applies. */
const managing = new Set(["/admin/set-user-password", "/admin/revoke-user-sessions"]);

function requestedRole(ctx: Ctx): UserRole | undefined {
  const { role, data } = body(ctx);
  const candidate = role ?? (data && typeof data === "object" ? (data as Row).role : undefined);
  return isUserRole(candidate) ? candidate : undefined;
}

const forbidden = () =>
  new APIError("FORBIDDEN", {
    code: "OWNER_PROTECTED",
    message: "Only an owner can change an owner account or grant the owner role.",
  });

export function createHooks(db: () => Executor) {
  const before = createAuthMiddleware(async (ctx) => {
    if (ctx.path === "/sign-in/email") {
      const email = normalizeEmail(body(ctx).email);
      if (email && (await lockedUntil(db(), email))) {
        throw new APIError("TOO_MANY_REQUESTS", {
          code: "ACCOUNT_LOCKED",
          message: t("error.locked", { minutes: lockMinutes }),
        });
      }
      return;
    }

    const rule = audited[ctx.path];
    if (!rule) return;

    const actor = await actorOf(ctx);
    const targetId = await rule.target(ctx, db(), actor);
    const manages = managing.has(ctx.path);
    const row = targetId && (rule.diff || manages) ? await loadUser(db(), targetId) : null;

    if (actor && manages && row) {
      const target = { id: String(row.id), role: row.role as UserRole };
      if (!canManageUser(actor, target, requestedRole(ctx))) throw forbidden();
    }
    if (actor && ctx.path === "/admin/create-user" && requestedRole(ctx) === "owner") {
      if (actor.role !== "owner") throw forbidden();
    }

    // Resetting a password by e-mail link: the account owner is the actor.
    const actorId = actor?.id ?? (ctx.path === "/reset-password" ? (targetId ?? null) : null);
    setPending(ctx, { actorId, targetId, before: rule.diff ? row : undefined });
  });

  const after = createAuthMiddleware(async (ctx) => {
    const returned: unknown = ctx.context.returned;
    const failed = isAPIError(returned);

    if (ctx.path === "/sign-in/email") {
      const email = normalizeEmail(body(ctx).email);
      if (!email) return;
      if (!failed) await clearFailures(db(), email);
      else if (returned.statusCode === 401) await recordFailure(db(), email);
      return;
    }

    const rule = audited[ctx.path];
    const state = pending(ctx);
    if (!rule || !state || failed) return;

    let targetId = state.targetId;
    if (ctx.path === "/admin/create-user") {
      targetId = str((returned as { user?: Row } | undefined)?.user?.id);
    }
    if (!targetId) return;

    await audit(db(), {
      actorId: state.actorId,
      action: rule.action,
      entityType: "user",
      entityId: targetId,
      before: rule.diff ? (state.before ?? null) : undefined,
      after: rule.diff ? await loadUser(db(), targetId) : undefined,
      headers: ctx.headers,
    });
  });

  return { before, after };
}
