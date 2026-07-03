"use client";

import { Store } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";

interface VendorImageProps {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  className?: string;
  iconClassName?: string;
  fetchPriority?: "high" | "low" | "auto";
}

/**
 * Thin client wrapper around <ProductImage> that supplies the vendor
 * fallback icon. The `Store` icon component is referenced here — inside a
 * client module — rather than being passed as a prop from a server
 * component, which React cannot serialize across the RSC boundary.
 */
export function VendorImage({
  src,
  alt,
  sizes,
  className,
  iconClassName,
  fetchPriority,
}: VendorImageProps) {
  return (
    <ProductImage
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      icon={Store}
      iconClassName={iconClassName}
      fetchPriority={fetchPriority}
    />
  );
}
