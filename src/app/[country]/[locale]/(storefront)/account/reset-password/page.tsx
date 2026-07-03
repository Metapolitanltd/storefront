import { redirect } from "next/navigation";
import { isVeroAuth } from "@/lib/auth-provider";
import { VERO_LOGIN_PATH } from "@/lib/vero/config";
import SpreeResetPassword from "../_spree/ResetPassword";

interface PageProps {
  params: Promise<{ country: string; locale: string }>;
}

export default async function ResetPasswordPage({ params }: PageProps) {
  // Vero hosts password reset — forward into the hosted login flow.
  if (isVeroAuth()) {
    const { country, locale } = await params;
    const returnTo = encodeURIComponent(`/${country}/${locale}/account`);
    redirect(`${VERO_LOGIN_PATH}?returnTo=${returnTo}`);
  }
  return <SpreeResetPassword />;
}
