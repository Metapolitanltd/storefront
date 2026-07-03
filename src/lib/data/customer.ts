"use server";

import type { Customer } from "@spree/sdk";
import { updateTag } from "next/cache";
import { getClient, withAuthRefresh } from "@/lib/spree";
import { actionResult } from "./utils";

/**
 * Get the currently authenticated customer from Spree, with the Vero JWT
 * injected as the bearer token. Returns null when not authenticated or on a
 * transient error — `withVeroAuth` (inside `withAuthRefresh`) already clears the
 * Vero session on a hard 401, so callers can treat null as "logged out".
 */
export async function getCustomer(): Promise<Customer | null> {
  try {
    return await withAuthRefresh((options) => {
      return getClient().customer.get(options);
    });
  } catch {
    return null;
  }
}

/**
 * Update the customer's profile. Only the display name is editable here — email
 * and password are owned by Vero's hosted account UI and cannot be changed from
 * the storefront.
 */
export async function updateCustomer(data: {
  first_name?: string;
  last_name?: string;
}) {
  return actionResult(async () => {
    const customer = await withAuthRefresh((options) => {
      return getClient().customer.update(data, options);
    });
    updateTag("customer");
    return { customer };
  }, "Update failed");
}
