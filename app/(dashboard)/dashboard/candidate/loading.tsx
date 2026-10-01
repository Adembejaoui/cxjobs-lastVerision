import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          <div className="h-4 w-24 animate-pulse bg-slate-200 rounded" />
        </CardTitle>
        <div className="h-4 w-4 animate-pulse bg-slate-200 rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 animate-pulse bg-slate-200 rounded" />
      </CardContent>
    </Card>
  );
}

function QuickActionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          <div className="h-5 w-32 animate-pulse bg-slate-200 rounded" />
        </CardTitle>
        <div className="h-4 w-48 animate-pulse bg-slate-200 rounded mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse bg-slate-200 rounded-lg" />
        ))}
      </CardContent>
    </Card>
  );
}

function RecentApplicationSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-200 p-4 animate-pulse">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200" />
      <div className="flex-1 min-w-0">
        <div className="h-4 w-32 bg-slate-200 rounded mb-1" />
        <div className="h-3 w-40 bg-slate-200 rounded" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="h-5 w-16 bg-slate-200 rounded" />
        <div className="h-3 w-14 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

function CareerGuideCardSkeleton() {
  return (
    <Card className="h-full animate-pulse">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="h-12 w-12 flex-shrink-0 rounded-xl bg-slate-200" />
          <div className="flex items-center gap-1.5 text-sm">
            <div className="h-4 w-4 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="h-5 w-40 bg-slate-200 rounded mt-4" />
        <div className="h-4 w-48 bg-slate-200 rounded mt-2" />
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2 text-sm" role="list">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-4 border-t border-slate-100">
        <div className="h-10 w-full bg-slate-200 rounded-xl" />
      </CardFooter>
    </Card>
  );
}

export default function CandidateDashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded mb-2" />
          <div className="h-5 w-72 bg-slate-200 rounded" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Quick Actions & Recent Applications */}
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActionSkeleton />
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="h-6 w-40 bg-slate-200 rounded mb-1" />
                <div className="h-4 w-56 bg-slate-200 rounded" />
              </div>
              <div className="h-8 w-24 bg-slate-200 rounded" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <RecentApplicationSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Career Guide Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-7 w-40 bg-slate-200 rounded mb-1" />
            <div className="h-4 w-64 bg-slate-200 rounded" />
          </div>
          <div className="h-8 w-24 bg-slate-200 rounded" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <CareerGuideCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}