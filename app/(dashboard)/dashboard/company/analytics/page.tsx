import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { CompanyAnalyticsClientV2 } from "./company-analytics-client-v2";
import { CompanyAnalyticsData } from "@/types/company-analytics";

async function fetchAnalytics(days: number, language: string, refresh: boolean) {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const cookie = headersList.get("cookie") || "";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

  const params = new URLSearchParams();
  params.set("days", String(days));
  params.set("language", language);
  if (refresh) params.set("refresh", "true");

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/dashboard/company/analytics?${params.toString()}`, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
    });
  } catch {
    return { success: false as const, error: "Unable to load analytics data" };
  }

  if (res.status === 401) {
    redirect("/login");
  }
  if (res.status === 403) {
    redirect("/dashboard/candidate");
  }

  if (!res.ok) {
    return { success: false as const, error: "Failed to load analytics" };
  }

  return (await res.json()) as { success: boolean; data?: CompanyAnalyticsData; error?: string };
}

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

  const result = await fetchAnalytics(safeDays, language, refresh);

  if (!result.success || !result.data) {
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
