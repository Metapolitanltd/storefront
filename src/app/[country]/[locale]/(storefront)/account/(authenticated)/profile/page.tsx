"use client";

import { isVeroAuth } from "@/lib/auth-provider";
import SpreeProfile from "../_spree/Profile";
import VeroProfile from "../_vero/Profile";

export default function ProfilePage() {
  return isVeroAuth() ? <VeroProfile /> : <SpreeProfile />;
}
