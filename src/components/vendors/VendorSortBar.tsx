"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FilterDropdown } from "@/components/products/filters";
import { SortDropdownContent } from "@/components/products/filters/SortDropdownContent";
import {
  buildListingSearchParams,
  parseListingSearchParams,
} from "@/lib/utils/listing-search-params";

/**
 * Sort options exposed by the vendors endpoint. Unlike products (whose
 * options come from the filters facet response), the vendors endpoint has
 * no facet metadata, so this list is static. Each id is a `sort` value the
 * API honors; labels are resolved by `getSortLabel` inside SortDropdownContent.
 */
const VENDOR_SORT_OPTIONS = [
  { id: "-created_at" }, // Newest
  { id: "created_at" }, // Oldest
  { id: "name" }, // Name (A-Z)
  { id: "-name" }, // Name (Z-A)
];

interface VendorSortBarProps {
  activeSortBy?: string;
  totalCount: number;
}

/**
 * The vendor listing's top bar: a result count plus a Sort dropdown,
 * matching the products listing bar's right-hand side. Sort selection is
 * written to the URL (`?sort=`), so the server component re-renders with
 * the new ordering — the same URL-driven pattern as ListingFilterBar.
 */
export function VendorSortBar({
  activeSortBy,
  totalCount,
}: VendorSortBarProps) {
  const t = useTranslations("products");
  const tv = useTranslations("vendors");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSortChange = (sortBy: string) => {
    const current = parseListingSearchParams(searchParams);
    const next = buildListingSearchParams(
      new URLSearchParams(searchParams.toString()),
      {
        query: current.query,
        filters: { ...current.filters, sortBy },
      },
    );
    const query = next.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    setIsOpen(false);
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  };

  return (
    <div className="mb-6" aria-busy={isPending}>
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <span className="text-sm text-gray-500">
          {tv("vendorCount", { count: totalCount })}
        </span>
        <FilterDropdown
          label={t("sort")}
          isOpen={isOpen}
          onToggle={() => setIsOpen(true)}
          onClose={() => setIsOpen(false)}
          align="right"
        >
          <SortDropdownContent
            sortOptions={VENDOR_SORT_OPTIONS}
            activeSortBy={activeSortBy}
            onSortChange={handleSortChange}
          />
        </FilterDropdown>
      </div>
    </div>
  );
}
