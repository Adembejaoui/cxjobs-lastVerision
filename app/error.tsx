"use client";

import Link from "next/link";

/**
 * Route-level error boundary. Never renders `error.message`: in production
 * Next.js replaces server error messages anyway, and client errors may carry
 * internal details. The opaque `digest` lets support correlate with logs.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <h1 className="text-3xl font-bold text-[#1f3d73] md:text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-slate-600">
        An unexpected error occurred. Please try again; if the problem persists, come back in a few minutes.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-2xl bg-brand-green-strong px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-green-strong-hover"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
