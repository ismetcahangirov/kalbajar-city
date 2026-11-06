import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { accounts, rateLimits, sessions, users, verifications } from "@/db/schema";
import { t } from "@/lib/admin/messages";
import { escapeHtml, sendMail } from "@/lib/mail";

import { createHooks } from "./hooks";
import { adminPaths, authBasePath, passwordLength } from "./paths";
import { accessControl, roles } from "./permissions";

const resetLinkLifetime = 60 * 60;

/**
 * Better Auth's endpoints that change a role or end an account. They cannot
 * hold the last-owner rule, which needs a lock across the check and the write,
 * so these changes go through `/api/v1/admin/users` (`@/lib/admin/users`) only.
 */
const closedPaths = [
  "/admin/set-role",
  "/admin/update-user",
  "/admin/ban-user",
  "/admin/unban-user",
  "/admin/remove-user",
];

function env(name: "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

async function sendResetEmail(user: { email: string; name: string }, url: string) {
  const values = { name: user.name };
  const lines = [
    t("mail.reset.greeting", values),
    t("mail.reset.lead"),
    url,
    t("mail.reset.footer"),
  ];
  await sendMail({
    to: user.email,
    subject: t("mail.reset.subject"),
    text: lines.join("\n\n"),
    html: [
      `<p>${escapeHtml(t("mail.reset.greeting", values))}</p>`,
      `<p>${escapeHtml(t("mail.reset.lead"))}</p>`,
      `<p><a href="${escapeHtml(url)}">${escapeHtml(t("mail.reset.action"))}</a></p>`,
      `<p>${escapeHtml(t("mail.reset.footer"))}</p>`,
    ].join("\n"),
  });
}

function createAuth() {
  const db = getDb();
  const hooks = createHooks(getDb);

  return betterAuth({
    appName: "Kalbajar City",
    baseURL: env("BETTER_AUTH_URL"),
    basePath: authBasePath,
    secret: env("BETTER_AUTH_SECRET"),
    disabledPaths: closedPaths,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        rateLimit: rateLimits,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Accounts are created by an owner or admin, or by `pnpm auth:owner`.
      disableSignUp: true,
      minPasswordLength: passwordLength.min,
      maxPasswordLength: passwordLength.max,
      resetPasswordTokenExpiresIn: resetLinkLifetime,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        const [row] = await db
          .select({ banned: users.banned })
          .from(users)
          .where(eq(users.id, user.id));
        if (!row || row.banned) return;
        await sendResetEmail(user, url);
      },
    },
    session: {
      // The console holds buyers' contact details: a week, renewed daily.
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        lastSignInAt: { type: "date", required: false, input: false },
      },
    },
    // Per IP, in the database so every instance shares the counters. The
    // per-address lock after repeated failures is in ./throttle.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
      },
    },
    hooks,
    databaseHooks: {
      session: {
        create: {
          async after(session) {
            await db
              .update(users)
              .set({ lastSignInAt: new Date() })
              .where(eq(users.id, session.userId));
          },
        },
      },
    },
    plugins: [
      admin({
        ac: accessControl,
        roles,
        defaultRole: "editor",
        adminRoles: ["owner", "admin"],
        bannedUserMessage: t("error.banned"),
      }),
      // Lets server actions set the session cookie; keep it last.
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { auth?: Auth };

/** Better Auth, created on first use so `next build` needs no secret or database. */
export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}

export const resetPasswordPage = adminPaths.resetPassword;
