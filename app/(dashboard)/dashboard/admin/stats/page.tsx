import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from "@/lib/application-status";

/**
 * Admin statistics (launch plan F5). Every number is a live database count;
 * nothing is estimated or hard-coded. Access is enforced by the admin layout
 * and re-checked here (defence in depth).
 */
export const dynamic = "force-dynamic";

const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
  EXPIRED: "Expired",
};

async function loadStats() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const [usersByRole, suspended, jobsByStatus, livePublished, appsByStatus, newUsers30, newJobs30, newApps30] =
    await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.jobOffer.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.jobOffer.count({
        where: { status: "PUBLISHED", deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
      prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.jobOffer.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      prisma.application.count({ where: { createdAt: { gte: since } } }),
    ]);
  const byKey = <T extends { _count: { _all: number } }>(rows: T[], key: keyof T) =>
    Object.fromEntries(rows.map((r) => [String(r[key]), r._count._all])) as Record<string, number>;
  return {
    users: byKey(usersByRole, "role"),
    suspended,
    jobs: byKey(jobsByStatus, "status"),
    livePublished,
    applications: byKey(appsByStatus, "status"),
    newUsers30,
    newJobs30,
    newApps30,
  };
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value.toLocaleString("en-US")}</p>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

export default async function AdminStatsPage() {
  await requireAdmin();

  let stats: Awaited<ReturnType<typeof loadStats>> | null = null;
  try {
    stats = await loadStats();
  } catch (error) {
    logger.error("Admin stats failed to load", { error: error instanceof Error ? error.name : "unknown" });
  }

  if (!stats) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Statistics</h1>
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Statistics could not be loaded. Please try again.
        </p>
      </div>
    );
  }

  const totalApps = Object.values(stats.applications).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Statistics</h1>
        <p className="mt-1 text-sm text-slate-600">Live counts from the database.</p>
      </div>

      <section aria-labelledby="stats-accounts">
        <h2 id="stats-accounts" className="mb-3 text-lg font-semibold text-slate-900">Accounts</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Candidates" value={stats.users.CANDIDATE ?? 0} />
          <Stat label="Companies" value={stats.users.COMPANY ?? 0} />
          <Stat label="Administrators" value={stats.users.ADMIN ?? 0} />
          <Stat label="Suspended accounts" value={stats.suspended} />
        </div>
      </section>

      <section aria-labelledby="stats-jobs">
        <h2 id="stats-jobs" className="mb-3 text-lg font-semibold text-slate-900">Jobs</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Live (published, not expired)" value={stats.livePublished} />
          {Object.entries(JOB_STATUS_LABELS).map(([key, label]) => (
            <Stat key={key} label={label} value={stats.jobs[key] ?? 0} hint={key === "PUBLISHED" ? "Includes expired jobs not yet closed" : undefined} />
          ))}
        </div>
      </section>

      <section aria-labelledby="stats-apps">
        <h2 id="stats-apps" className="mb-3 text-lg font-semibold text-slate-900">Applications</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Stat label="Total" value={totalApps} />
          {APPLICATION_STATUSES.map((s) => (
            <Stat key={s} label={APPLICATION_STATUS_LABELS[s]} value={stats.applications[s] ?? 0} />
          ))}
        </div>
      </section>

      <section aria-labelledby="stats-30d">
        <h2 id="stats-30d" className="mb-3 text-lg font-semibold text-slate-900">Last 30 days</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="New accounts" value={stats.newUsers30} />
          <Stat label="New jobs" value={stats.newJobs30} />
          <Stat label="New applications" value={stats.newApps30} />
        </div>
      </section>
    </div>
  );
}
