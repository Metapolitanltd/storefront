import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Vendor } from "@/lib/data/vendors";
import { VendorImage } from "./VendorImage";

interface VendorHeaderProps {
  vendor: Vendor;
  basePath: string;
  backLabel: string;
}

export function VendorHeader({
  vendor,
  basePath,
  backLabel,
}: VendorHeaderProps) {
  return (
    <div>
      {/* Cover photo */}
      {vendor.cover_photo_url && (
        <div className="relative h-40 sm:h-56 bg-gray-100">
          <VendorImage
            src={vendor.cover_photo_url}
            alt={vendor.name}
            className="object-cover"
            sizes="100vw"
            fetchPriority="high"
          />
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Link
          href={`${basePath}/vendors`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>

        <div className="mt-4 flex items-center gap-4">
          {vendor.logo_url && (
            <div className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200">
              <VendorImage
                src={vendor.logo_url}
                alt={vendor.name}
                className="object-cover"
                sizes="64px"
              />
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900">{vendor.name}</h1>
        </div>

        {vendor.about_us_html ? (
          <div
            className="prose prose-gray mt-4 max-w-3xl"
            // Vendor "about" copy is authored in the Spree admin — rendered as
            // HTML like product descriptions and store policies elsewhere.
            dangerouslySetInnerHTML={{ __html: vendor.about_us_html }}
          />
        ) : vendor.about_us ? (
          <p className="mt-4 max-w-3xl text-gray-600 whitespace-pre-wrap">
            {vendor.about_us}
          </p>
        ) : null}
      </div>
    </div>
  );
}
