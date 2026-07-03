import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProductListing } from "@/components/products/ProductListing";
import { VendorHeader } from "@/components/vendors/VendorHeader";
import { getCachedVendor } from "@/lib/data/cached";
import { resolveCurrency } from "@/lib/data/markets";
import { getProductFilters } from "@/lib/data/products";
import { getVendorProducts } from "@/lib/data/vendors";
import { generateVendorMetadata } from "@/lib/metadata/vendor";
import { parseListingSearchParams } from "@/lib/utils/listing-search-params";

interface VendorPageProps {
  params: Promise<{
    country: string;
    locale: string;
    slug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: VendorPageProps): Promise<Metadata> {
  const { country, locale, slug } = await params;
  return generateVendorMetadata({ country, locale, slug });
}

export default async function VendorPage({
  params,
  searchParams,
}: VendorPageProps) {
  const { country, locale, slug } = await params;
  const rawSearchParams = await searchParams;
  const basePath = `/${country}/${locale}`;

  let vendor;
  try {
    vendor = await getCachedVendor(slug);
  } catch (error) {
    console.error("Failed to fetch vendor:", error);
    notFound();
  }

  if (!vendor) {
    notFound();
  }

  const currency = await resolveCurrency(country);
  const listingState = parseListingSearchParams(rawSearchParams);
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "vendors",
  });

  // Pre-bind vendorId onto the server action so the client-side
  // InfiniteProductList island gets a single-arg (params) fetcher it can
  // call directly for subsequent pages. Mirrors the category page.
  const fetchVendorProducts = getVendorProducts.bind(null, vendor.id);

  return (
    <div>
      <VendorHeader
        vendor={vendor}
        basePath={basePath}
        backLabel={t("backToVendors")}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          {t("products")}
        </h2>

        <ProductListing
          state={listingState}
          basePath={basePath}
          currency={currency}
          locale={locale as Locale}
          listId={`vendor-${vendor.id}`}
          listName={`Vendor: ${vendor.name}`}
          baseParams={{ vendor_id_eq: vendor.id }}
          fetchProducts={fetchVendorProducts}
          fetchFilters={getProductFilters}
          emptyMessage={t("noProducts")}
        />
      </div>
    </div>
  );
}
