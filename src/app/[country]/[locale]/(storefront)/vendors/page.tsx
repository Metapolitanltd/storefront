import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VendorGrid } from "@/components/vendors/VendorGrid";
import { getVendors } from "@/lib/data/vendors";
import { generateVendorsMetadata } from "@/lib/metadata/vendors";

interface VendorsPageProps {
  params: Promise<{
    country: string;
    locale: string;
  }>;
}

export async function generateMetadata({
  params,
}: VendorsPageProps): Promise<Metadata> {
  const { country, locale } = await params;
  return generateVendorsMetadata({ country, locale });
}

export default async function VendorsPage({ params }: VendorsPageProps) {
  const { country, locale } = await params;
  const basePath = `/${country}/${locale}`;

  const [{ data: vendors }, t] = await Promise.all([
    getVendors(),
    getTranslations({ locale: locale as Locale, namespace: "vendors" }),
  ]);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-2 text-gray-500">{t("subtitle")}</p>
      </div>

      <VendorGrid
        vendors={vendors}
        basePath={basePath}
        priorityCount={6}
        emptyMessage={t("noVendors")}
      />
    </div>
  );
}
