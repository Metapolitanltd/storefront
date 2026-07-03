import Link from "next/link";
import type { Vendor } from "@/lib/data/vendors";
import { stripHtml } from "@/lib/seo";
import { VendorImage } from "./VendorImage";

interface VendorCardProps {
  vendor: Vendor;
  basePath?: string;
  fetchPriority?: "high" | "low" | "auto";
}

export function VendorCard({
  vendor,
  basePath = "",
  fetchPriority,
}: VendorCardProps) {
  const imageUrl = vendor.cover_photo_url || vendor.logo_url;
  const about =
    vendor.about_us ||
    (vendor.about_us_html ? stripHtml(vendor.about_us_html) : null);

  return (
    <Link href={`${basePath}/vendors/${vendor.slug}`} className="group block">
      {/* Image */}
      <div className="relative aspect-square bg-gray-100 rounded-md overflow-hidden">
        <VendorImage
          src={imageUrl}
          alt={vendor.name}
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 300px"
          iconClassName="w-16 h-16"
          fetchPriority={fetchPriority}
        />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors line-clamp-2">
          {vendor.name}
        </h3>
        {about && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{about}</p>
        )}
      </div>
    </Link>
  );
}
