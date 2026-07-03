import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VendorListing } from "@/components/vendors/VendorListing";
import { generateVendorsMetadata } from "@/lib/metadata/vendors";
import { parseListingSearchParams } from "@/lib/utils/listing-search-params";

interface VendorsPageProps {
  params: Promise<{
    country: string;
    locale: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: VendorsPageProps): Promise<Metadata> {
  const { country, locale } = await params;
  return generateVendorsMetadata({ country, locale });
}

export default async function VendorsPage({
  params,
  searchParams,
}: VendorsPageProps) {
  const { country, locale } = await params;
  const rawSearchParams = await searchParams;
  const basePath = `/${country}/${locale}`;

  const listingState = parseListingSearchParams(rawSearchParams);
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "vendors",
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-2 text-gray-500">{t("subtitle")}</p>
      </div>

      <VendorListing
        state={listingState}
        basePath={basePath}
        locale={locale as Locale}
      />
    </div>
  );
}
