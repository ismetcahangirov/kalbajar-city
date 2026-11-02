"use client";

import { Eye, EyeOff, Tag, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { adminMoney } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import {
  applyBulkChange,
  bulkChangeSchema,
  type AdminApartment,
  type ApartmentBulkResult,
  type BulkChange,
} from "@/shared/apartments";
import { apartmentStatuses, aznToMinor, type ApartmentStatus } from "@/shared/inventory";
import { useBulkUpdateApartmentsMutation } from "@/store/endpoints/admin-apartments";

const name = (apartment: AdminApartment) => `${apartment.block}-${apartment.number}`;

/** How many of the apartments the change would alter. */
function countChanges(apartments: AdminApartment[], change: BulkChange): number {
  return apartments.filter((apartment) => {
    const next = applyBulkChange(apartment, change);
    return next.status !== apartment.status || next.priceMinor !== apartment.priceMinor;
  }).length;
}

function doneMessage({ updated, unchanged }: ApartmentBulkResult): string {
  return unchanged ? t("bulk.doneUnchanged", { updated, unchanged }) : t("bulk.done", { updated });
}

/**
 * The bulk actions for the selected apartments: a status, publishing
 * (`not_for_sale` → `available`) and unpublishing (→ `not_for_sale`), and,
 * for roles that may, a price change previewed before it is applied. Each is
 * one request and one transaction.
 */
export function BulkBar({
  selected,
  canPrice,
  onClear,
}: {
  selected: ReadonlyMap<string, AdminApartment>;
  canPrice: boolean;
  onClear: () => void;
}) {
  const confirm = useConfirm();
  const [bulkUpdate, { isLoading }] = useBulkUpdateApartmentsMutation();
  const [status, setStatus] = useState<ApartmentStatus | "">("");
  const [priceOpen, setPriceOpen] = useState(false);
  const headingId = useId();
  const hintId = useId();
  const apartments = useMemo(() => [...selected.values()], [selected]);

  const apply = async (change: BulkChange, title: string): Promise<boolean> => {
    const changed = countChanges(apartments, change);
    if (changed === 0) {
      toast.info(t("bulk.nothing"));
      return false;
    }
    const confirmed = await confirm({
      title,
      description: t("bulk.confirmLead", { changed, unchanged: apartments.length - changed }),
      confirmLabel: t("bulk.apply"),
    });
    if (!confirmed) return false;
    try {
      const result = await bulkUpdate({ ids: [...selected.keys()], change }).unwrap();
      toast.success(doneMessage(result));
      onClear();
      return true;
    } catch (error) {
      toastApiError(error);
      return false;
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="bg-background shadow-md sticky bottom-0 z-10 flex flex-col gap-3 rounded-md border p-3 md:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="font-medium">
          {t("bulk.title")}:{" "}
          <span role="status" className="font-normal">
            {t("bulk.selected", { count: selected.size })}
          </span>
        </h2>
        <Button type="button" variant="ghost" onClick={onClear}>
          <X aria-hidden />
          {t("bulk.clear")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${headingId}-status`}>{t("bulk.status")}</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as ApartmentStatus)}>
            <SelectTrigger id={`${headingId}-status`} className="min-w-44">
              <SelectValue placeholder={t("apartments.field.choose")} />
            </SelectTrigger>
            <SelectContent>
              {apartmentStatuses.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          disabled={!status || isLoading}
          onClick={() =>
            status &&
            void apply(
              { kind: "status", status },
              t("bulk.confirmStatus", { count: selected.size, status: t(`status.${status}`) }),
            ).then((done) => done && setStatus(""))
          }
        >
          {t("bulk.applyStatus")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          aria-describedby={hintId}
          onClick={() => void apply({ kind: "publish" }, t("bulk.confirmPublish"))}
        >
          <Eye aria-hidden />
          {t("bulk.publish")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          aria-describedby={hintId}
          onClick={() => void apply({ kind: "unpublish" }, t("bulk.confirmUnpublish"))}
        >
          <EyeOff aria-hidden />
          {t("bulk.unpublish")}
        </Button>
        {canPrice ? (
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => setPriceOpen(true)}
          >
            <Tag aria-hidden />
            {t("bulk.price")}
          </Button>
        ) : null}
      </div>
      <p id={hintId} className="text-sm text-muted-foreground hidden md:block">
        {t("bulk.publishHint")}
      </p>

      {canPrice ? (
        <PriceDialog
          open={priceOpen}
          onOpenChange={setPriceOpen}
          apartments={apartments}
          busy={isLoading}
          onApply={async (change) => {
            try {
              const result = await bulkUpdate({ ids: [...selected.keys()], change }).unwrap();
              toast.success(doneMessage(result));
              setPriceOpen(false);
              onClear();
            } catch (error) {
              toastApiError(error);
            }
          }}
        />
      ) : null}
    </section>
  );
}

const previewLimit = 50;

type PriceMode = "priceSet" | "pricePercent";

/** The price change: an amount in AZN for all, or a percentage, with the result shown before it is applied. */
function PriceDialog({
  open,
  onOpenChange,
  apartments,
  busy,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apartments: AdminApartment[];
  busy: boolean;
  onApply: (change: BulkChange) => Promise<void>;
}) {
  const id = useId();
  const [mode, setMode] = useState<PriceMode>("pricePercent");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");

  const change = useMemo((): BulkChange | null => {
    if (mode === "priceSet") {
      const minor = aznToMinor(amount);
      return minor === undefined ? null : { kind: "priceSet", priceMinor: minor };
    }
    const value = Number(percent.trim().replace(",", "."));
    const parsed = bulkChangeSchema.safeParse({ kind: "pricePercent", percent: value });
    return percent.trim() && parsed.success ? parsed.data : null;
  }, [mode, amount, percent]);

  const touched = mode === "priceSet" ? amount !== "" : percent !== "";
  const error =
    touched && !change
      ? t(mode === "priceSet" ? "bulk.invalidPrice" : "bulk.invalidPercent")
      : null;
  const preview = change
    ? apartments.map((apartment) => ({ apartment, next: applyBulkChange(apartment, change) }))
    : [];
  const changed = preview.filter(({ apartment, next }) => next.priceMinor !== apartment.priceMinor);
  const money = (minor: string | null, currency: string) =>
    minor === null ? t("apartments.noPrice") : adminMoney(minor, currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("bulk.priceTitle")}</DialogTitle>
          <DialogDescription>{t("bulk.priceLead")}</DialogDescription>
        </DialogHeader>

        <form
          className="flex min-w-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (change && changed.length) void onApply(change);
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm mb-2 font-medium">{t("bulk.priceMode")}</legend>
            {(
              [
                ["pricePercent", t("bulk.priceModePercent")],
                ["priceSet", t("bulk.priceModeSet")],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex min-h-target items-center gap-3">
                <input
                  type="radio"
                  name={`${id}-mode`}
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="accent-primary size-5"
                />
                {label}
              </label>
            ))}
          </fieldset>

          {mode === "priceSet" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-amount`}>{t("bulk.priceAmount")}</Label>
              <Input
                id={`${id}-amount`}
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={`${id}-amount-hint${error ? ` ${id}-error` : ""}`}
              />
              <p id={`${id}-amount-hint`} className="text-sm text-muted-foreground">
                {t("bulk.priceAmountHint")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-percent`}>{t("bulk.pricePercent")}</Label>
              <Input
                id={`${id}-percent`}
                inputMode="decimal"
                autoComplete="off"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={`${id}-percent-hint${error ? ` ${id}-error` : ""}`}
              />
              <p id={`${id}-percent-hint`} className="text-sm text-muted-foreground">
                {t("bulk.pricePercentHint")}
              </p>
            </div>
          )}
          <p id={`${id}-error`} role="alert" className="text-sm text-destructive empty:hidden">
            {error}
          </p>

          {change ? (
            <section className="flex min-w-0 flex-col gap-2" aria-labelledby={`${id}-preview`}>
              <h3 id={`${id}-preview`} className="font-medium">
                {t("bulk.preview")}
              </h3>
              <p role="status" className="text-sm">
                {t("bulk.previewChanged", { count: changed.length })}
              </p>
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableCaption className="sr-only">{t("bulk.previewCaption")}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{t("apartments.number")}</TableHead>
                      <TableHead scope="col" className="text-right">
                        {t("bulk.previewCurrent")}
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        {t("bulk.previewNext")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, previewLimit).map(({ apartment, next }) => (
                      <TableRow key={apartment.id}>
                        <TableHead scope="row" className="text-foreground font-medium">
                          {name(apartment)}
                        </TableHead>
                        <TableCell className="text-right">
                          {money(apartment.priceMinor, apartment.currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {money(next.priceMinor, apartment.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.length > previewLimit ? (
                <p className="text-sm text-muted-foreground">
                  {t("bulk.previewMore", { count: preview.length - previewLimit })}
                </p>
              ) : null}
            </section>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("ui.cancel")}
            </Button>
            <Button type="submit" disabled={!change || !changed.length || busy}>
              {busy ? t("bulk.applying") : t("bulk.apply")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
