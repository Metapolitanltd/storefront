import type { Metadata } from "next";
import { buildCanonicalUrl } from "@/lib/seo";
import { getStoreUrl } from "@/lib/store";

interface VendorsMetadataParams {
  country: string;
  locale: string;
}

export async function generateVendorsMetadata({
  country,
  locale,
}: VendorsMetadataParams): Promise<Metadata> {
  const storeUrl = getStoreUrl();
  const canonicalUrl = storeUrl
    ? buildCanonicalUrl(storeUrl, `/${country}/${locale}/vendors`)
    : undefined;

  const title = "Vendors";
  const description = "Browse the vendors in our marketplace.";

  return {
    title,
    description,
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      title,
      description,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      type: "website",
    },
  };
}
