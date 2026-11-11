/** Branded loading state for route segments (launch plan P6). */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="h-12 w-12 animate-spin rounded-full border-4 border-brand-navy border-t-transparent motion-reduce:animate-none"
        />
        <p className="text-sm font-medium text-slate-700">{label}</p>
      </div>
    </div>
  );
}
