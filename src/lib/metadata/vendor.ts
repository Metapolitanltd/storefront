import type { Metadata } from "next";
import { getCachedVendor } from "@/lib/data/cached";
import { buildCanonicalUrl, stripHtml } from "@/lib/seo";
import { getStoreUrl } from "@/lib/store";

export interface VendorMetadataParams {
  country: string;
  locale: string;
  slug: string;
}

export async function generateVendorMetadata({
  country,
  locale,
  slug,
}: VendorMetadataParams): Promise<Metadata> {
  let vendor;
  try {
    vendor = await getCachedVendor(slug);
  } catch {
    return { title: "Vendor Not Found" };
  }

  const title = vendor.name;
  const description = vendor.about_us_html
    ? stripHtml(vendor.about_us_html)
    : vendor.about_us || `Browse products from ${vendor.name}.`;

  const image = vendor.cover_photo_url || vendor.logo_url;

  const storeUrl = getStoreUrl();
  const canonicalUrl = storeUrl
    ? buildCanonicalUrl(
        storeUrl,
        `/${country}/${locale}/vendors/${vendor.slug}`,
      )
    : undefined;

  return {
    title,
    description,
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      title,
      description,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      type: "website",
      ...(image ? { images: [{ url: image, alt: vendor.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
