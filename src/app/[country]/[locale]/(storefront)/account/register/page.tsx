import { redirect } from "next/navigation";
import { isVeroAuth } from "@/lib/auth-provider";
import { VERO_LOGIN_PATH } from "@/lib/vero/config";
import SpreeRegister from "../_spree/Register";

interface PageProps {
  params: Promise<{ country: string; locale: string }>;
}

export default async function RegisterPage({ params }: PageProps) {
  // Vero hosts registration — forward into the hosted login flow.
  if (isVeroAuth()) {
    const { country, locale } = await params;
    const returnTo = encodeURIComponent(`/${country}/${locale}/account`);
    redirect(`${VERO_LOGIN_PATH}?returnTo=${returnTo}`);
  }
  return <SpreeRegister />;
}
