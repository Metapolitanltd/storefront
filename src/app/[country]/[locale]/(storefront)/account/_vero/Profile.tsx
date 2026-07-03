"use client";

import { useTranslations } from "next-intl";
import { useVeroAuth } from "@/contexts/VeroAuthContext";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const { user } = useVeroAuth();

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t("loadingProfile")}</p>
      </div>
    );
  }
  console.log({ user });
  const fullName =
    `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "—";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("profile")}</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {t("accountInformation")}
          </h2>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">{t("name")}</dt>
              <dd className="mt-1 text-sm text-gray-900">{fullName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t("email")}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.email || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t("accountId")}
              </dt>
              <dd className="mt-1 text-sm text-gray-900 break-all">
                {user.id}
              </dd>
            </div>
          </dl>

          <p className="mt-6 text-sm text-gray-500">{t("managedByVero")}</p>
        </div>
      </div>
    </div>
  );
}
