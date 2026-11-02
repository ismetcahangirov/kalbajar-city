"use client";

import { useEffect, useMemo } from "react";

import type { Locale } from "@/i18n/routing";
import {
  parseCatalogueParams,
  toApartmentListParams,
  type CatalogueQuery,
} from "@/shared/catalogue";
import { useApartmentsQuery } from "@/store/endpoints/apartments";
import { StoreProvider } from "@/store/provider";

type Props = {
  /** The settled draft, as `JSON.stringify(CatalogueQuery)`. */
  queryKey: string;
  /** Nothing to ask while the draft is what the page already shows. */
  skip: boolean;
  locale: Locale;
  onCount: (result: { key: string; total: number }) => void;
};

/**
 * The live result count behind the catalogue's filters: Redux and RTK Query
 * with their own store. The filters load this module only on the visitor's
 * first interaction, so the catalogue's first load ships no Redux. Renders
 * nothing; the count goes back through `onCount`.
 */
export default function CatalogueCount(props: Props) {
  return (
    <StoreProvider>
      <Count {...props} />
    </StoreProvider>
  );
}

function Count({ queryKey, skip, locale, onCount }: Props) {
  const params = useMemo(
    () => toApartmentListParams(parseCatalogueParams(JSON.parse(queryKey) as CatalogueQuery)),
    [queryKey],
  );
  const { currentData, isFetching } = useApartmentsQuery(
    { ...params, pageSize: 1, locale },
    { skip },
  );
  useEffect(() => {
    if (!skip && !isFetching && currentData) onCount({ key: queryKey, total: currentData.total });
  }, [skip, isFetching, currentData, queryKey, onCount]);
  return null;
}
