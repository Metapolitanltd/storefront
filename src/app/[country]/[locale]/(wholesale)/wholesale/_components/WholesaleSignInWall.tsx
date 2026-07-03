"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVeroAuth } from "@/contexts/VeroAuthContext";
import { safeRedirectPath } from "@/lib/utils/path";

interface WholesaleSignInWallProps {
  basePath: string;
  storefrontAccess?: string;
}

/**
 * Landing shown to guests hitting the gated portal. Sign-in goes through Vero's
 * hosted login — the storefront never handles credentials — and the callback
 * returns the buyer to `?redirect=` (defaults to the portal home), where the
 * server layout re-renders and the gate re-evaluates.
 */
export function WholesaleSignInWall({
  basePath,
  storefrontAccess,
}: WholesaleSignInWallProps) {
  const t = useTranslations("wholesale");
  const searchParams = useSearchParams();
  const { signIn } = useVeroAuth();

  const wholesaleBase = `${basePath}/wholesale`;
  const redirectUrl = safeRedirectPath(
    searchParams.get("redirect"),
    wholesaleBase,
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="flex flex-col justify-center">
        <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
          <Building2 className="h-3.5 w-3.5" />
          {t("badge")}
        </div>
        <h1 className="text-3xl font-bold text-slate-900">
          {t("signInWall.title")}
        </h1>
        <p className="mt-4 text-slate-600">{t("signInWall.description")}</p>
        {storefrontAccess === "login_required" && (
          <p className="mt-4 text-sm text-slate-500">
            {t("signInWall.gatedNotice")}
          </p>
        )}
        <div className="mt-8">
          <p className="text-sm text-slate-600">
            {t("signInWall.noAccount")}{" "}
            <Link
              href={`${wholesaleBase}/apply`}
              className="font-medium text-slate-900 underline underline-offset-4"
            >
              {t("signInWall.applyLink")}
            </Link>
          </p>
        </div>
      </div>

      <Card>
        {/* `signInWall.formDescription` refers to email + password, which Vero's
            hosted login owns — so the card shows only the title. */}
        <CardHeader>
          <CardTitle>{t("signInWall.formTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            size="lg"
            className="w-full bg-slate-900 hover:bg-slate-800"
            onClick={() => signIn(redirectUrl)}
          >
            {t("signInWall.submit")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
