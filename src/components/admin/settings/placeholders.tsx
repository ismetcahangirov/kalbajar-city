"use client";

import { Check, TriangleAlert } from "lucide-react";
import { createContext, use, type ReactNode } from "react";

import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { Button } from "@/components/admin/ui/button";
import { t } from "@/lib/admin/messages";
import { placeholderField } from "@/lib/admin/settings-sections";
import { cn } from "@/lib/admin/utils";
import { homeSectionScope, scopeOf } from "@/shared/placeholders";
import {
  useConfirmPlaceholdersMutation,
  useSettingsPlaceholdersQuery,
} from "@/store/endpoints/admin-settings";

type Abilities = { settings: boolean; content: boolean };

type Context = { paths: readonly string[]; abilities: Abilities };

const PlaceholdersContext = createContext<Context>({
  paths: [],
  abilities: { settings: false, content: false },
});

/**
 * The stand-in values still waiting for the owner (#27), for the settings
 * screen: the server's list on the first render, then the live one, which
 * every save refreshes.
 */
export function PlaceholdersProvider({
  initial,
  abilities,
  children,
}: {
  initial: string[];
  /** Whether the user may change settings, and the location section (content). */
  abilities: Abilities;
  children: ReactNode;
}) {
  const { data } = useSettingsPlaceholdersQuery();
  return (
    <PlaceholdersContext value={{ paths: data?.paths ?? initial, abilities }}>
      {children}
    </PlaceholdersContext>
  );
}

/** The flagged paths, optionally only those in one scope. */
export function usePlaceholders(scope?: string): readonly string[] {
  const { paths } = use(PlaceholdersContext);
  return scope ? paths.filter((path) => scopeOf(path) === scope) : paths;
}

/**
 * Marks a field whose value is a stand-in: words and an icon, not colour
 * alone. Saving another value removes the flag; "Confirm" keeps the value
 * and removes it too, for a stand-in that turns out to be right.
 */
export function PlaceholderFlag({ path, className }: { path: string; className?: string }) {
  const { paths, abilities } = use(PlaceholdersContext);
  const [confirm, { isLoading }] = useConfirmPlaceholdersMutation();
  if (!paths.includes(path)) return null;

  const scope = scopeOf(path);
  const canConfirm =
    scope === homeSectionScope("location") ? abilities.content : abilities.settings;

  return (
    <div
      data-placeholder={path}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-accent px-3 py-2",
        className,
      )}
    >
      <p className="text-sm inline-flex items-start gap-1.5 font-medium text-text-accent">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t("placeholder.badge")}
      </p>
      {canConfirm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading}
          aria-label={t("placeholder.confirmField", { field: placeholderField(path) })}
          onClick={async () => {
            try {
              await confirm({ paths: [path] }).unwrap();
              toast.success(t("placeholder.confirmed"));
            } catch (error) {
              toastApiError(error);
            }
          }}
        >
          <Check aria-hidden />
          {t("placeholder.confirm")}
        </Button>
      ) : null}
    </div>
  );
}
