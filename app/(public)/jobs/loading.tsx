import { Card, CardContent } from "@/components/ui/card";

function JobCardSkeleton() {
  return (
    <Card className="flex flex-col h-full animate-pulse">
      <CardContent className="flex flex-col h-full p-5">
        <div className="flex gap-4">
          <div className="h-14 w-14 rounded-xl bg-slate-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-5 w-48 bg-slate-200 rounded mb-1" />
            <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
            <div className="flex flex-wrap gap-2">
              <div className="h-4 w-40 bg-slate-200 rounded" />
              <div className="h-4 w-4 bg-slate-200 rounded" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-4 w-20 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
        <div className="mt-auto pt-4 flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="h-5 w-20 bg-slate-200 rounded" />
            <div className="h-5 w-24 bg-slate-200 rounded" />
          </div>
          <div className="h-8 w-24 bg-slate-200 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSkeleton() {
  return (
    <div className="flex flex-wrap gap-4 animate-pulse">
      <div className="h-10 w-40 bg-slate-200 rounded" />
      <div className="h-10 w-40 bg-slate-200 rounded" />
      <div className="h-10 w-40 bg-slate-200 rounded" />
      <div className="h-10 w-40 bg-slate-200 rounded" />
    </div>
  );
}

export default function JobsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-8 w-40 bg-slate-200 rounded mb-2" />
        <div className="h-5 w-80 bg-slate-200 rounded" />
      </div>

      {/* Filters */}
      <FilterSkeleton />

      {/* Job Grid */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-8 flex items-center justify-center gap-2">
        <div className="h-10 w-10 bg-slate-200 rounded" />
        <div className="h-10 w-10 bg-slate-200 rounded" />
        <div className="h-10 w-10 bg-slate-200 rounded" />
        <div className="h-10 w-10 bg-slate-200 rounded" />
        <div className="h-10 w-10 bg-slate-200 rounded" />
      </div>
    </div>
  );
}