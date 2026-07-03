"use client";

import type { PaginatedResponse } from "@spree/sdk";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Vendor, VendorListParams } from "@/lib/data/vendors";
import { VendorCard } from "./VendorCard";

interface InfiniteVendorListProps {
  initialVendors: Vendor[];
  initialPage: number;
  totalPages: number;
  /** List params describing the current sort state, incl. the page `limit`. */
  listParams: VendorListParams;
  /** Server action fetching one page of vendors. */
  fetchPage: (params: VendorListParams) => Promise<PaginatedResponse<Vendor>>;
  basePath: string;
}

/**
 * Infinite-scroll vendor list. Mirrors InfiniteProductList: hydrates with
 * the server-rendered first page, then fetches subsequent pages via the
 * provided server action when the sentinel enters the viewport.
 *
 * Scroll position ("how many pages have I loaded") is ephemeral client
 * state. A sort change unmounts this component (via the key on the listing
 * state) and remounts it with a fresh initial page.
 */
export function InfiniteVendorList({
  initialVendors,
  initialPage,
  totalPages,
  listParams,
  fetchPage,
  basePath,
}: InfiniteVendorListProps) {
  const t = useTranslations("vendors");
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [knownPages, setKnownPages] = useState(totalPages);
  const [hasError, setHasError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = currentPage < knownPages;

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const knownPagesRef = useRef(knownPages);
  knownPagesRef.current = knownPages;
  const hasErrorRef = useRef(hasError);
  hasErrorRef.current = hasError;
  const isLoadingRef = useRef(false);

  const loadNextPage = useCallback(() => {
    if (isLoadingRef.current || hasErrorRef.current) return;
    const nextPage = currentPageRef.current + 1;
    if (nextPage > knownPagesRef.current) return;
    isLoadingRef.current = true;

    startTransition(async () => {
      try {
        const response = await fetchPage({ ...listParams, page: nextPage });
        setVendors((prev) => {
          const existing = new Set(prev.map((v) => v.id));
          const appended = response.data.filter((v) => !existing.has(v.id));
          return [...prev, ...appended];
        });
        setCurrentPage(nextPage);
        setKnownPages(response.meta.pages);
      } catch (error) {
        console.error("InfiniteVendorList: failed to load next page", error);
        setHasError(true);
      } finally {
        isLoadingRef.current = false;
      }
    });
  }, [fetchPage, listParams]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage]);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {vendors.map((vendor, index) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            basePath={basePath}
            fetchPriority={index < 6 ? "high" : undefined}
          />
        ))}
      </div>

      <div
        ref={sentinelRef}
        className="h-20 flex items-center justify-center mt-8"
      >
        {isPending && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="animate-spin h-5 w-5" />
            {t("loadingMore")}
          </div>
        )}
        {!hasError && !hasMore && vendors.length > 0 && (
          <p className="text-gray-500 text-sm">{t("noMoreVendors")}</p>
        )}
      </div>
    </>
  );
}
