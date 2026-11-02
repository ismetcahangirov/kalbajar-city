import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { fieldMessage, issueMessage } from "@/components/admin/form/messages";
import { applyApiErrors } from "@/components/admin/form/use-admin-form";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { translatableSchema } from "@/shared/translatable";

/** What a console form shows for each invalid field of `input`. */
function messages(schema: z.ZodType, input: unknown): Record<string, string> {
  const result = schema.safeParse(input, { error: issueMessage });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [
      issue.path.join("."),
      fieldMessage({ type: issue.code, message: issue.message }),
    ]),
  );
}

describe("console form messages", () => {
  it("speaks Azerbaijani for zod's own checks, with their limits", () => {
    const schema = z.object({
      name: z.string().trim().min(2).max(5),
      email: z.email(),
      site: z.url(),
      count: z.number().min(3),
      tags: z.array(z.string()).max(1),
      kind: z.enum(["a", "b"]),
    });
    expect(
      messages(schema, {
        name: "x",
        email: "nope",
        site: "nope",
        count: 1,
        tags: ["a", "b"],
        kind: "c",
      }),
    ).toEqual({
      name: "Ən azı 2 simvol yazın.",
      email: "Düzgün e-poçt ünvanı yazın.",
      site: "Düzgün link yazın.",
      count: "Dəyər ən azı 3 olmalıdır.",
      tags: "Ən çox 1 seçim edin.",
      kind: "Siyahıdakı dəyərlərdən birini seçin.",
    });
    expect(messages(schema.pick({ name: true }), {})).toEqual({ name: "Bu xananı doldurun." });
  });

  it("asks for the Azerbaijani text of a translatable field", () => {
    expect(messages(z.object({ title: translatableSchema }), { title: { az: " " } })).toEqual({
      "title.az": "Bu xananı doldurun.",
    });
  });

  it("translates catalogue keys and never shows a schema's or the server's English", () => {
    expect(messages(z.string().min(1, "error.required").pipe(z.email("error.email")), "a")).toEqual(
      { "": "Düzgün e-poçt ünvanı yazın." },
    );
    expect(messages(z.string().regex(/^\d+$/, "Amount must be whole minor units"), "x")).toEqual({
      "": "Dəyərin formatı düzgün deyil.",
    });
    expect(fieldMessage({ type: "server", message: "That value is already taken." })).toBe(
      "Server bu dəyəri qəbul etmədi. Yoxlayıb yenidən göndərin.",
    );
    expect(fieldMessage({ type: "custom", message: "Change at least one field" })).toBe(
      "Dəyər düzgün deyil.",
    );
  });
});

describe("API errors in forms", () => {
  const failure = (code: string, fields?: Record<string, string[]>) => ({
    status: 422,
    data: {
      error: { code, message: "The request has invalid fields.", ...(fields && { fields }) },
    },
  });

  it("puts each field error on its input, focusing the first, and returns the form message", () => {
    const setError = vi.fn();
    const message = applyApiErrors(
      { setError },
      failure("VALIDATION_FAILED", {
        "title.en": ["Too long"],
        priceMinor: ["Amount must be whole minor units"],
        root: ["Change at least one field"],
      }),
    );
    expect(message).toBe("Bəzi xanalar düzgün doldurulmayıb.");
    expect(setError.mock.calls).toEqual([
      ["title.en", { type: "server", message: "Too long" }, { shouldFocus: true }],
      [
        "priceMinor",
        { type: "server", message: "Amount must be whole minor units" },
        { shouldFocus: false },
      ],
    ]);
  });

  it("describes every failure in Azerbaijani by its code", () => {
    expect(apiErrorMessage(failure("FORBIDDEN"))).toBe("Rolunuz bu əməliyyata icazə vermir.");
    expect(apiErrorMessage(failure("CONFLICT"))).toMatch(/artıq istifadə olunur/);
    expect(apiErrorMessage(failure("SOMETHING_NEW"))).toBe("Xəta baş verdi. Yenidən cəhd edin.");
    expect(apiErrorMessage({ status: "FETCH_ERROR", error: "TypeError" })).toBe(
      "Serverə qoşulmaq olmadı. İnternet bağlantısını yoxlayın.",
    );
  });
});
