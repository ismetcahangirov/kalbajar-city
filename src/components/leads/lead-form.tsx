"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button, Checkbox, Icon, Input, Text, Textarea } from "@/components/ui";
import { ArrowBlock } from "@/components/ui/arrow-block";
import { FieldBox, FieldBoxInput, FieldNote } from "@/components/ui/field-box";
import { formatPhone } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cx } from "@/lib/cx";
import { captureAttribution } from "@/lib/leads/attribution";
import {
  leadSubmissionSchema,
  viewingUtcOffset,
  type LeadSubmission,
  type LeadType,
} from "@/shared/leads";
import { normalizePhone } from "@/shared/phone";
import { useSubmitLeadMutation } from "@/store/endpoints/leads";
import { apiErrorOf } from "@/store/errors";
import { StoreProvider } from "@/store/provider";

export type LeadFormProps = {
  type: LeadType;
  /** The apartment the form is about: its slug, and the number shown to the visitor. */
  apartment?: { slug: string; label: string };
  /** The id of the heading that names the form. */
  labelledBy?: string;
  /**
   * `hairline`: the reference's `FieldBox` form on the theme tokens, with
   * the `ArrowBlock` submit (the inquiry dialog). `default`: the current
   * pages' fields, until #66/#68 move them over.
   */
  appearance?: "default" | "hairline";
  className?: string;
};

type Field = "name" | "phone" | "email" | "preferredAt" | "message" | "consent";

/** The fields each form shows, in tab order. */
const fieldsByType: Record<LeadType, readonly Field[]> = {
  inquiry: ["name", "phone", "email", "message", "consent"],
  viewing: ["name", "phone", "email", "preferredAt", "message", "consent"],
  callback: ["name", "phone", "consent"],
};

type Values = { name: string; phone: string; email: string; preferredAt: string; message: string };

const empty: Values = { name: "", phone: "", email: "", preferredAt: "", message: "" };

type Notice = "invalid" | "network" | "rateLimited" | "server";

/** `2026-11-10T11:00` from a datetime-local input, as an ISO time in Baku. */
function bakuIso(local: string): string | undefined {
  if (!local) return undefined;
  return `${local.length === 16 ? `${local}:00` : local}${viewingUtcOffset}`;
}

/** The current minute in Baku, as a datetime-local value, for the picker's `min`. */
function bakuNow(): string {
  const offsetMs = 4 * 60 * 60 * 1000;
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 16);
}

/**
 * The inquiry, viewing and call-back form (#22). One component for all three:
 * `type` picks the fields. It validates with the API's own schema before it
 * sends, reports every invalid field at once (in an `aria-live` summary, with
 * focus on the first one), and keeps what was typed when sending fails.
 * Forms never animate: every state appears at once.
 *
 * A client island with its own store, so a page that shows it needs no
 * other client-side data.
 */
export function LeadForm(props: LeadFormProps) {
  return (
    <StoreProvider>
      <LeadFormBody {...props} />
    </StoreProvider>
  );
}

function LeadFormBody({
  type,
  apartment,
  labelledBy,
  appearance = "default",
  className,
}: LeadFormProps) {
  const hairline = appearance === "hairline";
  const t = useTranslations("LeadForm");
  const locale = useLocale();
  const id = useId();
  const fieldId = (field: Field) => `${id}-${field}`;
  const fields = fieldsByType[type];

  const [values, setValues] = useState<Values>(empty);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [notice, setNotice] = useState<{ kind: Notice; text: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [minAt, setMinAt] = useState<string>();
  const [submitLead, { isLoading }] = useSubmitLeadMutation();

  const startedAt = useRef(0);
  const website = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // The time trap starts when a person could start typing.
    startedAt.current = Date.now();
    captureAttribution();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is read after hydration
    setMinAt(bakuNow());
  }, []);

  useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  const label: Record<Field, string> = {
    name: t("name"),
    phone: t("phone"),
    email: t("email"),
    preferredAt: t("preferredAt"),
    message: t("message"),
    consent: t("consentLabel"),
  };

  /** Editing a field clears its error; the summary stays until the next send. */
  function clearError(field: Field) {
    setErrors((current) => {
      if (!current[field]) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });
  }

  function set<K extends keyof Values>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    clearError(key);
  }

  function errorFor(field: Field): string {
    if (field === "preferredAt" && values.preferredAt) return t("error.preferredAtRange");
    return t(`error.${field}`);
  }

  /** Marks the fields, announces the summary and moves focus to the first. */
  function report(invalid: Field[]) {
    setErrors(Object.fromEntries(invalid.map((field) => [field, errorFor(field)])));
    setNotice({
      kind: "invalid",
      text: t("error.summary", {
        count: invalid.length,
        fields: invalid.map((field) => label[field]).join(", "),
      }),
    });
    const first = invalid[0];
    if (first) document.getElementById(fieldId(first))?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const attribution = captureAttribution();
    const submission = {
      type,
      name: values.name,
      phone: values.phone,
      email: fields.includes("email") ? values.email : undefined,
      message: fields.includes("message") ? values.message : undefined,
      preferredAt: type === "viewing" ? bakuIso(values.preferredAt) : undefined,
      apartment: apartment?.slug,
      locale,
      sourcePath: window.location.pathname,
      utm: attribution.utm,
      referrer: attribution.referrer,
      consent,
      website: website.current?.value ?? "",
      startedAt: startedAt.current,
      sentAt: Date.now(),
    };

    // The API's own schema; context it rejects (a stray referrer) is the
    // server's to answer, so only the visitor's fields block sending here.
    const parsed = leadSubmissionSchema.safeParse(submission);
    const invalid = parsed.success
      ? []
      : fields.filter((field) => parsed.error.issues.some((issue) => issue.path[0] === field));
    if (invalid.length) return report(invalid);

    setErrors({});
    setNotice(null);
    try {
      await submitLead(parsed.success ? parsed.data : (submission as LeadSubmission)).unwrap();
      track("generate_lead", { lead_type: type, ...(apartment && { apartment: apartment.slug }) });
      setSent(true);
    } catch (error) {
      const api = apiErrorOf(error);
      if (!api) return setNotice({ kind: "network", text: t("error.network") });
      if (api.code === "RATE_LIMITED") {
        return setNotice({ kind: "rateLimited", text: t("error.rateLimited") });
      }
      const rejected = fields.filter((field) => api.fields?.[field]);
      if (rejected.length) return report(rejected);
      setNotice({ kind: "server", text: t("error.server") });
    }
  }

  function again() {
    setValues(empty);
    setConsent(false);
    setNotice(null);
    setSent(false);
    startedAt.current = Date.now();
    // The form is back after this render; its first field takes focus.
    requestAnimationFrame(() => document.getElementById(fieldId("name"))?.focus());
  }

  const field = (name: Field) => ({ id: fieldId(name), error: errors[name] });

  const consentLabel = t.rich("consent", {
    link: (chunks) => (
      <Link
        href="/mexfilik-siyaseti"
        target="_blank"
        rel="noopener"
        className="underline decoration-1 underline-offset-4"
      >
        {chunks}
        <span className="sr-only"> {t("newTab")}</span>
      </Link>
    ),
  });

  return (
    <div className={cx("flex flex-col gap-6", className)}>
      {/* Always rendered, so what is put in it is announced. Success moves focus instead. */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {notice && (
          <p
            className={cx(
              "flex items-start gap-2 border-s-2 border-error ps-4 text-body",
              // On sand the error colour fails as text: it marks the rule and the icon.
              hairline ? "text-(--t-text) [&_svg]:text-error" : "text-error",
            )}
          >
            <Icon icon={CircleAlert} className="mt-1" />
            <span>{notice.text}</span>
          </p>
        )}
      </div>

      {sent ? (
        <div className="flex flex-col items-start gap-4">
          <p
            ref={successRef}
            tabIndex={-1}
            className={cx(
              "flex items-center gap-3 outline-none",
              hairline ? "text-lead text-(--t-text)" : "text-legacy-title text-text",
            )}
          >
            <span className={hairline ? undefined : "text-status-available"}>
              <Icon icon={CircleCheck} size={24} />
            </span>
            {t("success.title")}
          </p>
          {hairline ? (
            <>
              <p className="text-body">{t("success.body")}</p>
              <ArrowBlock as="button" tone="ink" onClick={again}>
                {t("success.again")}
              </ArrowBlock>
            </>
          ) : (
            <>
              <Text tone="muted">{t("success.body")}</Text>
              <Button variant="secondary" onClick={again}>
                {t("success.again")}
              </Button>
            </>
          )}
        </div>
      ) : hairline ? (
        <form
          method="post"
          noValidate
          aria-labelledby={labelledBy}
          onSubmit={onSubmit}
          className="@container flex flex-col gap-u2"
        >
          {apartment && <p className="text-body">{t("apartment", { label: apartment.label })}</p>}
          <div className="flex flex-col gap-u">
            <FieldBox columns={2}>
              <FieldBoxInput
                {...field("name")}
                label={label.name}
                name="name"
                autoComplete="name"
                required
                maxLength={120}
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
              />
              <FieldBoxInput
                {...field("phone")}
                label={label.phone}
                helper={t("phoneHelper")}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                maxLength={32}
                value={values.phone}
                onChange={(event) => set("phone", event.target.value)}
                onBlur={() => {
                  const e164 = normalizePhone(values.phone);
                  if (e164) set("phone", formatPhone(e164));
                }}
              />
              {fields.includes("email") && (
                <FieldBoxInput
                  {...field("email")}
                  label={label.email}
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={values.email}
                  onChange={(event) => set("email", event.target.value)}
                  // Alone on its row when no date follows it.
                  className={fields.includes("preferredAt") ? undefined : "@lg:col-span-full"}
                />
              )}
              {fields.includes("preferredAt") && (
                <FieldBoxInput
                  {...field("preferredAt")}
                  label={label.preferredAt}
                  helper={t("preferredAtHelper")}
                  name="preferredAt"
                  type="datetime-local"
                  required
                  min={minAt}
                  step={900}
                  value={values.preferredAt}
                  onChange={(event) => set("preferredAt", event.target.value)}
                />
              )}
              {fields.includes("message") && (
                <FieldBoxInput
                  {...field("message")}
                  multiline
                  label={label.message}
                  name="message"
                  maxLength={2000}
                  value={values.message}
                  onChange={(event) => set("message", event.target.value)}
                />
              )}
            </FieldBox>
            {(["name", "phone", "email", "preferredAt", "message"] as const)
              .filter((name) => fields.includes(name) && errors[name])
              .map((name) => (
                <FieldNote key={name} id={`${fieldId(name)}-error`} tone="error">
                  {errors[name]}
                </FieldNote>
              ))}
            <FieldNote id={`${fieldId("phone")}-helper`}>{t("phoneHelper")}</FieldNote>
            {fields.includes("preferredAt") && (
              <FieldNote id={`${fieldId("preferredAt")}-helper`}>
                {t("preferredAtHelper")}
              </FieldNote>
            )}
          </div>

          <div aria-hidden className="sr-only">
            <label htmlFor={`${id}-website`}>{t("honeypot")}</label>
            <input
              ref={website}
              id={`${id}-website`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <div className="flex flex-col gap-1">
            <Checkbox
              id={fieldId("consent")}
              size="box"
              name="consent"
              required
              checked={consent}
              error={errors.consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                clearError("consent");
              }}
              label={consentLabel}
            />
            {errors.consent && (
              <FieldNote id={`${fieldId("consent")}-error`} tone="error">
                {errors.consent}
              </FieldNote>
            )}
          </div>

          <ArrowBlock
            as="button"
            type="submit"
            tone="ink"
            aria-disabled={isLoading || undefined}
            className="self-center"
          >
            {isLoading ? t("submitting") : t(`submit.${type}`)}
          </ArrowBlock>
        </form>
      ) : (
        <form
          method="post"
          noValidate
          aria-labelledby={labelledBy}
          onSubmit={onSubmit}
          className="@container flex flex-col gap-6"
        >
          {apartment && (
            <Text className="font-medium">{t("apartment", { label: apartment.label })}</Text>
          )}

          <div className="grid gap-6 @lg:grid-cols-2">
            <Input
              {...field("name")}
              label={label.name}
              name="name"
              autoComplete="name"
              required
              maxLength={120}
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
            />
            <Input
              {...field("phone")}
              label={label.phone}
              helper={t("phoneHelper")}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={32}
              value={values.phone}
              onChange={(event) => set("phone", event.target.value)}
              onBlur={() => {
                const e164 = normalizePhone(values.phone);
                if (e164) set("phone", formatPhone(e164));
              }}
            />
          </div>

          {fields.includes("email") && (
            <Input
              {...field("email")}
              label={label.email}
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={values.email}
              onChange={(event) => set("email", event.target.value)}
            />
          )}

          {fields.includes("preferredAt") && (
            <Input
              {...field("preferredAt")}
              label={label.preferredAt}
              helper={t("preferredAtHelper")}
              name="preferredAt"
              type="datetime-local"
              required
              min={minAt}
              step={900}
              value={values.preferredAt}
              onChange={(event) => set("preferredAt", event.target.value)}
            />
          )}

          {fields.includes("message") && (
            <Textarea
              {...field("message")}
              label={label.message}
              name="message"
              maxLength={2000}
              value={values.message}
              onChange={(event) => set("message", event.target.value)}
            />
          )}

          {/* The honeypot: hidden from people and assistive technology alike. */}
          <div aria-hidden className="sr-only">
            <label htmlFor={`${id}-website`}>{t("honeypot")}</label>
            <input
              ref={website}
              id={`${id}-website`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <Checkbox
            {...field("consent")}
            name="consent"
            required
            checked={consent}
            onChange={(event) => {
              setConsent(event.target.checked);
              clearError("consent");
            }}
            label={consentLabel}
          />

          <div>
            <Button
              type="submit"
              size="lg"
              aria-disabled={isLoading || undefined}
              className="w-full @md:w-auto"
            >
              {isLoading ? t("submitting") : t(`submit.${type}`)}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
