import { redirect } from "next/navigation";
import { VERO_LOGIN_PATH } from "@/lib/vero/config";

interface PageProps {
  params: Promise<{ country: string; locale: string }>;
}

// Registration is hosted by Vero — forward into the hosted login flow.
export default async function RegisterPage({ params }: PageProps) {
  const { country, locale } = await params;
  const returnTo = encodeURIComponent(`/${country}/${locale}/account`);
  redirect(`${VERO_LOGIN_PATH}?returnTo=${returnTo}`);
}
