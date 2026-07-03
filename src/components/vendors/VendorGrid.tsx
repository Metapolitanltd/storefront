import type { Vendor } from "@/lib/data/vendors";
import { VendorCard } from "./VendorCard";

interface VendorGridProps {
  vendors: Vendor[];
  basePath?: string;
  emptyMessage?: string;
  priorityCount?: number;
}

export function VendorGrid({
  vendors,
  basePath = "",
  emptyMessage,
  priorityCount = 0,
}: VendorGridProps) {
  if (vendors.length === 0 && emptyMessage) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
      {vendors.map((vendor, index) => (
        <VendorCard
          key={vendor.id}
          vendor={vendor}
          basePath={basePath}
          fetchPriority={index < priorityCount ? "high" : undefined}
        />
      ))}
    </div>
  );
}
