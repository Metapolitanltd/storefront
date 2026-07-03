"use server";

import type { PaginatedResponse, Product, ProductListParams } from "@spree/sdk";
import { cacheLife, cacheTag } from "next/cache";
import { getAccessToken, getClient, getLocaleOptions } from "@/lib/spree";

/**
 * Multi-vendor (marketplace) is a Spree Enterprise feature that is not
 * covered by `@spree/sdk`, so the vendor resource itself has no generated
 * types or typed client methods. We call those endpoints through the SDK's
 * low-level `StoreClient.request`, which reuses the same base URL, auth
 * headers, locale/currency headers, and retry logic as every built-in
 * resource. The shapes below mirror the `GET /api/v3/store/vendors` response.
 *
 * A vendor's *products*, however, are reachable through the standard
 * (SDK-typed) products endpoint via the Ransack predicate `q[vendor_id_eq]`,
 * so `getVendorProducts` uses `products.list` and gains pagination, sorting,
 * and faceted filtering for free — see the vendor detail page.
 */

/** Vendor returns address (internal shipping info — not customer-facing). */
export interface VendorAddress {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  address1: string | null;
  address2: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  company: string | null;
  country_name: string | null;
  country_iso: string | null;
  state_text: string | null;
  state_abbr: string | null;
  state_name: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  slug: string;
  about_us: string | null;
  about_us_html: string | null;
  logo_url: string | null;
  cover_photo_url: string | null;
  email: string;
  returns_address: VendorAddress | null;
}

/** Default page size — matches the product listing (PAGE_SIZE). */
const VENDOR_PAGE_SIZE = 12;

/**
 * List params accepted by the vendors endpoint. It supports `page`/`limit`
 * pagination and a `sort` field (e.g. 'name', '-name', 'created_at',
 * '-created_at'). It does NOT support Ransack `q[...]` predicates or
 * free-text search — see the vendor list page.
 */
export interface VendorListParams {
  page?: number;
  limit?: number;
  sort?: string;
  /** Passthrough for any other query param the endpoint accepts. */
  [key: string]: string | number | undefined;
}

/**
 * Cached vendor list fetch. Cache key is derived from all function
 * arguments by Next.js "use cache":
 *
 * - params (page/limit/sort): the requested slice + ordering.
 * - locale/country: translated content + market resolution (sent as
 *   x-spree-* headers by the SDK request layer).
 *
 * No per-user segmentation: vendor metadata is identical for every
 * shopper, so guests and authenticated users share one entry.
 */
async function cachedListVendors(
  params: VendorListParams,
  options: { locale?: string; country?: string },
) {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("vendors");
  return getClient().request<PaginatedResponse<Vendor>>("GET", "/vendors", {
    ...options,
    params,
  });
}

export async function getVendors(
  params?: VendorListParams,
): Promise<PaginatedResponse<Vendor>> {
  const options = await getLocaleOptions();
  return cachedListVendors({ limit: VENDOR_PAGE_SIZE, ...params }, options);
}

/** Cached vendor detail fetch (metadata only — products are fetched separately). */
async function cachedGetVendor(
  slug: string,
  options: { locale?: string; country?: string },
) {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("vendors", `vendor:${slug}`);
  return getClient().request<Vendor>("GET", `/vendors/${slug}`, { ...options });
}

export async function getVendor(slug: string): Promise<Vendor> {
  const options = await getLocaleOptions();
  return cachedGetVendor(slug, options);
}

/**
 * Persistent cached fetch of a vendor's products via the standard products
 * endpoint, scoped with the Ransack predicate `q[vendor_id_eq]`. The SDK
 * wraps the flat `vendor_id_eq` key into `q[vendor_id_eq]` automatically
 * (see `transformListParams`), the same way `in_category` is handled.
 *
 * Cache key is derived from all arguments (vendorId, params, locale,
 * country, userToken). Guests pass undefined so they share one entry;
 * authenticated users get a per-user segment (B2B / loyalty pricing).
 */
async function cachedListVendorProducts(
  vendorId: string,
  params: ProductListParams | undefined,
  options: { locale?: string; country?: string },
  _userToken?: string,
) {
  "use cache: remote";
  cacheLife("tenMinutes");
  cacheTag("products", `vendor-products:${vendorId}`);
  return getClient().products.list(
    { ...params, vendor_id_eq: vendorId },
    options,
  );
}

export async function getVendorProducts(
  vendorId: string,
  params?: ProductListParams,
): Promise<PaginatedResponse<Product>> {
  const options = await getLocaleOptions();
  const userToken = await getAccessToken();
  return cachedListVendorProducts(vendorId, params, options, userToken);
}
