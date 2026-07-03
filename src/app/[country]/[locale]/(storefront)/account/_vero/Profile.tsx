"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useVeroAuth } from "@/contexts/VeroAuthContext";
import { updateCustomer } from "@/lib/data/customer";

// Inner form component that resets when the user changes (via key prop).
function ProfileForm({
  user,
  refreshUser,
}: {
  user: {
    id: string;
    email?: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  refreshUser: () => Promise<void>;
}) {
  const t = useTranslations("profile");
  // Initialize form data from user props — no useEffect needed.
  const [formData, setFormData] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const result = await updateCustomer(formData);

    if (result.success) {
      toast.success(t("profileUpdated"));
      await refreshUser();
    } else {
      setError(result.error || t("failedToUpdate"));
    }

    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("profile")}</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field>
                <FieldLabel htmlFor="first_name">{t("firstName")}</FieldLabel>
                <Input
                  type="text"
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="last_name">{t("lastName")}</FieldLabel>
                <Input
                  type="text"
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="email">{t("emailAddress")}</FieldLabel>
              <Input
                type="email"
                id="email"
                value={user.email || ""}
                readOnly
                disabled
                aria-describedby="email_help"
              />
              <p id="email_help" className="text-sm text-gray-500">
                {t("managedByVero")}
              </p>
            </Field>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("saveChanges")}
            </Button>
          </div>
        </form>
      </div>

      {/* Account Info */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {t("accountInformation")}
          </h2>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t("accountId")}
              </dt>
              <dd className="mt-1 text-sm text-gray-900 break-all">
                {user.id}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t("email")}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.email || "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

// Main page component — uses key prop to reset the form when the user changes.
export default function ProfilePage() {
  const t = useTranslations("profile");
  const { user, refreshUser } = useVeroAuth();

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t("loadingProfile")}</p>
      </div>
    );
  }

  return <ProfileForm key={user.id} user={user} refreshUser={refreshUser} />;
}
