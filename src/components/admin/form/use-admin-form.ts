"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type FieldValues,
  type Path,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";

import { apiErrorMessage } from "@/lib/admin/api-error";
import { apiErrorOf } from "@/store/errors";

import { issueMessage } from "./messages";

/**
 * A console form: react-hook-form validating with a shared zod schema
 * (`@/shared/*`), the same one the endpoint parses with, so the browser and
 * the server agree. Messages come out in Azerbaijani (`./messages`).
 */
export function useAdminForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  options: Omit<UseFormProps<z.input<S>, unknown, z.output<S>>, "resolver"> = {},
): UseFormReturn<z.input<S>, unknown, z.output<S>> {
  return useForm<z.input<S>, unknown, z.output<S>>({
    mode: "onTouched",
    ...options,
    resolver: zodResolver(schema, { error: issueMessage }),
  });
}

/**
 * Puts a failed request's errors where the user will see them: each entry of
 * the API's `fields` on its input (by dotted path, `title.en`), focusing the
 * first. Returns the message for the form as a whole, to show in a
 * `FormAlert` or a toast.
 */
export function applyApiErrors<T extends FieldValues>(
  form: Pick<UseFormReturn<T, unknown, unknown>, "setError">,
  error: unknown,
): string {
  const fields = apiErrorOf(error)?.fields ?? {};
  let first = true;
  for (const [path, messages] of Object.entries(fields)) {
    if (path === "root") continue;
    form.setError(
      path as Path<T>,
      { type: "server", message: messages[0] ?? "" },
      { shouldFocus: first },
    );
    first = false;
  }
  return apiErrorMessage(error);
}
