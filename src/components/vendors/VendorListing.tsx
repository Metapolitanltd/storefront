import { Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { type ReactElement, Suspense } from "react";
import { FilterBarSkeleton } from "@/components/products/filters";
import { ProductGridSkeleton } from "@/components/products/ProductGridSkeleton";
import { getVendors, type VendorListParams } from "@/lib/data/vendors";
import {
  type ListingSearchParams,
  listingKey,
} from "@/lib/utils/listing-search-params";
import { InfiniteVendorList } from "./InfiniteVendorList";
import { VendorSortBar } from "./VendorSortBar";

const PAGE_SIZE = 12;

interface VendorListingProps {
  state: ListingSearchParams;
  basePath: string;
  locale: Locale;
  /** Shown when the fetch returns zero vendors. */
  emptyMessage?: string;
}

/**
 * Server-rendered vendor listing. Mirrors ProductListing: fetches page 1
 * inside a Suspense boundary so the surrounding shell streams immediately,
 * renders the sort bar + infinite-scroll grid, and remounts the client
 * island on every sort change (keyed on the listing state) with fresh
 * server-provided page-1 data.
 *
 * The vendors endpoint supports only pagination + `sort` (no facets, no
 * search), so the bar carries just a Sort control — no filter dropdowns.
 */
export function VendorListing(props: VendorListingProps): ReactElement {
  return (
    <Suspense
      fallback={
        <>
          <FilterBarSkeleton />
          <ProductGridSkeleton />
        </>
      }
    >
      <VendorListingInner {...props} />
    </Suspense>
  );
}

async function VendorListingInner({
  state,
  basePath,
  locale,
  emptyMessage,
}: VendorListingProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: "vendors" });

  // List params for the current sort state. The client island reuses this
  // (with an incremented page) when fetching subsequent pages.
  const listParams: VendorListParams = {
    limit: PAGE_SIZE,
    ...(state.filters.sortBy ? { sort: state.filters.sortBy } : {}),
  };

  const response = await getVendors({ ...listParams, page: 1 });
  const vendors = response.data;
  const totalCount = response.meta.count;
  const totalPages = response.meta.pages;

  return (
    <>
      <VendorSortBar
        activeSortBy={state.filters.sortBy}
        totalCount={totalCount}
      />

      {vendors.length > 0 ? (
        <InfiniteVendorList
          key={listingKey(state)}
          initialVendors={vendors}
          initialPage={1}
          totalPages={totalPages}
          listParams={listParams}
          fetchPage={getVendors}
          basePath={basePath}
        />
      ) : (
        <div className="text-center py-12">
          <Store
            className="mx-auto h-12 w-12 text-gray-400"
            strokeWidth={1.5}
          />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {t("noVendors")}
          </h3>
          {emptyMessage && <p className="mt-2 text-gray-500">{emptyMessage}</p>}
        </div>
      )}
    </>
  );
}
