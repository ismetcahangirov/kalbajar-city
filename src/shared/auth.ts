import { z } from "zod";

import { passwordLength } from "@/lib/auth/paths";

// The console's sign-in and password forms. Messages are console catalogue
// keys (`@/lib/admin/messages`), so the forms translate them.

const email = z.string().trim().min(1, "error.required").pipe(z.email("error.email"));

const newPassword = z
  .string()
  .min(passwordLength.min, "error.passwordShort")
  .max(passwordLength.max, "error.passwordLong");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "error.required"),
});

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: newPassword, confirm: z.string().min(1, "error.required") })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "error.passwordMismatch",
  });

/** The first message key per field, for showing under each input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    out[key] ??= issue.message;
  }
  return out;
}
