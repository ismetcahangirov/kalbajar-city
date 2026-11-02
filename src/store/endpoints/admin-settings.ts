import type { AdminHomeSection, HomeSectionContentByKey } from "@/shared/home-sections";
import type { PlaceholderConfirm, Placeholders } from "@/shared/placeholders";
import type { AdminSetting, EditableSettingsKey, SettingsValue } from "@/shared/settings";

import { baseApi } from "../api";

/** A settings save: one key and its whole new value. */
export type SettingUpdate = {
  [K in EditableSettingsKey]: { key: K; value: SettingsValue<K> };
}[EditableSettingsKey];

const placeholders = { type: "Settings", id: "placeholders" } as const;

/**
 * The console's settings screen (#27). A save invalidates its key and the
 * placeholder flags, which the server clears for the values it changed; the
 * server revalidates the public pages' tags.
 */
export const adminSettingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    settingsPlaceholders: build.query<Placeholders, void>({
      query: () => "/admin/placeholders",
      providesTags: [placeholders],
    }),
    confirmPlaceholders: build.mutation<Placeholders, PlaceholderConfirm>({
      query: (body) => ({ url: "/admin/placeholders/confirm", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : [placeholders]),
    }),
    updateSetting: build.mutation<AdminSetting, SettingUpdate>({
      query: ({ key, value }) => ({ url: `/admin/settings/${key}`, method: "PUT", body: value }),
      invalidatesTags: (_result, error, { key }) =>
        error ? [] : [{ type: "Settings", id: key }, placeholders],
    }),
    updateLocationSection: build.mutation<
      AdminHomeSection<"location">,
      HomeSectionContentByKey["location"]
    >({
      query: (body) => ({ url: "/admin/home-sections/location", method: "PUT", body }),
      invalidatesTags: (_result, error) =>
        error ? [] : [{ type: "HomeSection", id: "location" }, placeholders],
    }),
  }),
});

export const {
  useSettingsPlaceholdersQuery,
  useConfirmPlaceholdersMutation,
  useUpdateSettingMutation,
  useUpdateLocationSectionMutation,
} = adminSettingsApi;
