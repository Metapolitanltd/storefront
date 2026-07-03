"use client";

import { Building2, CheckCircle2, CircleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type User, useVeroAuth } from "@/contexts/VeroAuthContext";
import { updateCustomer } from "@/lib/data/customer";
import { extractBasePath } from "@/lib/utils/path";
import { wholesaleSignInHref } from "@/lib/wholesale";

/**
 * Wholesale application. Accounts are created through Vero's hosted login, so a
 * guest first signs in (or signs up) there and comes back here; the signed-in
 * buyer then submits their trade details, saved on the Spree customer record
 * (phone, and company as metadata the merchant sees on the admin customer
 * record). Approval is still an admin adding them to the Wholesale group, so on
 * success we show a received/pending confirmation rather than dropping them into
 * the portal.
 */
export default function WholesaleApplyPage() {
  const t = useTranslations("wholesale");
  const ta = useTranslations("account");
  const pathname = usePathname();
  const storeBase = extractBasePath(pathname);
  const wholesaleBase = `${storeBase}/wholesale`;
  const { user, loading, signIn } = useVeroAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="mx-auto h-8 w-1/2 rounded bg-slate-200" />
          <div className="mx-auto h-4 w-3/4 rounded bg-slate-200" />
          <div className="h-48 rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
        <Card>
          <ApplyHeader />
          <CardContent>
            <Button
              type="button"
              size="lg"
              className="w-full bg-slate-900 hover:bg-slate-800"
              onClick={() => signIn(`${wholesaleBase}/apply`)}
            >
              {ta("signIn")}
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              {t("apply.alreadyMember")}{" "}
              <Link
                href={wholesaleSignInHref(storeBase)}
                className="font-medium text-slate-900 hover:underline"
              >
                {t("signInWall.submit")}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <WholesaleApplicationForm
      key={user.id}
      user={user}
      wholesaleBase={wholesaleBase}
    />
  );
}

function ApplyHeader() {
  const t = useTranslations("wholesale");

  return (
    <CardHeader className="text-center">
      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Building2 className="h-6 w-6 text-slate-700" />
      </div>
      <CardTitle>{t("apply.title")}</CardTitle>
      <CardDescription>{t("apply.description")}</CardDescription>
    </CardHeader>
  );
}

// Keyed by user id so the prefilled name resets when the signed-in user changes.
function WholesaleApplicationForm({
  user,
  wholesaleBase,
}: {
  user: User;
  wholesaleBase: string;
}) {
  const t = useTranslations("wholesale");
  const tr = useTranslations("register");

  const [firstName, setFirstName] = useState(user.first_name ?? "");
  const [lastName, setLastName] = useState(user.last_name ?? "");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await updateCustomer({
      first_name: firstName,
      last_name: lastName,
      ...(phone && { phone }),
      // Company has no first-class customer column; persist it as metadata so
      // it reaches the applicant's admin record for the merchant's review.
      ...(company.trim() && { metadata: { company: company.trim() } }),
    });

    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error ?? tr("unexpectedError"));
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-700" />
            </div>
            <CardTitle>{t("apply.receivedTitle")}</CardTitle>
            <CardDescription>{t("apply.receivedDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="bg-slate-900 hover:bg-slate-800">
              <Link href={wholesaleBase}>{t("apply.goToPortal")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
      <Card>
        <ApplyHeader />

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="apply-first">{tr("firstName")}</FieldLabel>
                <Input
                  id="apply-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder={tr("firstNamePlaceholder")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="apply-last">{tr("lastName")}</FieldLabel>
                <Input
                  id="apply-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder={tr("lastNamePlaceholder")}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="apply-company">
                {t("apply.companyLabel")}
              </FieldLabel>
              <Input
                id="apply-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                placeholder={t("apply.companyPlaceholder")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="apply-phone">
                {t("apply.phoneLabel")}
              </FieldLabel>
              <Input
                id="apply-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("apply.phonePlaceholder")}
              />
            </Field>

            <Button
              type="submit"
              disabled={submitting}
              size="lg"
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
              {t("apply.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
