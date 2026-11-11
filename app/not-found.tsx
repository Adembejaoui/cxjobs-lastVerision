import Link from "next/link";
import { JobPreviewHint } from "@/components/job-preview-hint";

export const metadata = {
  title: "Page not found | CXJobs",
};

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-green-text">404</p>
      <h1 className="mt-2 text-3xl font-bold text-[#1f3d73] md:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-md text-slate-600">
        The page you are looking for does not exist, or the job offer is no longer available.
      </p>
      <JobPreviewHint />
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/jobs"
          className="rounded-2xl bg-brand-green-strong px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-green-strong-hover"
        >
          Browse jobs
        </Link>
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
