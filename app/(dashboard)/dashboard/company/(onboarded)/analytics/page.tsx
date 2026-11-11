import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCompanyAnalytics } from "@/lib/company-analytics";
import { CompanyAnalyticsClientV2 } from "./company-analytics-client-v2";

export default async function CompanyAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role !== "COMPANY") {
    redirect("/dashboard/candidate");
  }

  const sp = await searchParams;
  const daysParam = sp.days;
  const days = Array.isArray(daysParam)
    ? Number(daysParam[0])
    : Number(daysParam ?? 30);
  const safeDays = Number.isFinite(days) && days >= 7 && days <= 90 ? days : 30;
  const languageParam = sp.language;
  const language = Array.isArray(languageParam)
    ? languageParam[0] ?? "all"
    : (languageParam ?? "all");
  const refresh = sp.refresh === "true";

  // Direct server-side call: no internal HTTP round-trip to our own route handler.
  const result = await getCompanyAnalytics({
    userId: session.user.id,
    days: safeDays,
    language,
    refresh,
  });

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600">Company performance insights</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {result.error ?? "Unable to load analytics data."}
        </div>
      </div>
    );
  }

  return <CompanyAnalyticsClientV2 data={result.data} defaultDays={safeDays} />;
}
