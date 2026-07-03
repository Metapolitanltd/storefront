"use client";

import { isVeroAuth } from "@/lib/auth-provider";
import SpreeAccountOverview from "./_spree/AccountOverview";
import VeroAccountOverview from "./_vero/AccountOverview";

export default function AccountPage() {
  return isVeroAuth() ? <VeroAccountOverview /> : <SpreeAccountOverview />;
}
