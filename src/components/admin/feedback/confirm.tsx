"use client";

import { createContext, use, useCallback, useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { t } from "@/lib/admin/messages";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** A destructive action gets the destructive button. */
  destructive?: boolean;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

type Request = ConfirmOptions & { resolve: (confirmed: boolean) => void };

/**
 * One confirmation dialog for the whole console. `useConfirm()` opens it and
 * resolves to whether the user confirmed; Escape, the overlay and Cancel all
 * answer `false`, and focus returns to where it was.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);

  const confirm = useCallback<Confirm>(
    (options) => new Promise((resolve) => setRequest({ ...options, resolve })),
    [],
  );

  const answer = (confirmed: boolean) => {
    request?.resolve(confirmed);
    setRequest(null);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      <AlertDialog open={request !== null} onOpenChange={(open) => !open && answer(false)}>
        <AlertDialogContent {...(request?.description ? {} : { "aria-describedby": undefined })}>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            {request?.description ? (
              <AlertDialogDescription>{request.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => answer(false)}>
              {request?.cancelLabel ?? t("ui.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={request?.destructive ? "destructive" : "default"}
              onClick={() => answer(true)}
            >
              {request?.confirmLabel ?? t("ui.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext>
  );
}

/** Asks before a destructive or irreversible action: `if (await confirm({...})) …`. */
export function useConfirm(): Confirm {
  const confirm = use(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside the console's ConfirmProvider");
  return confirm;
}
