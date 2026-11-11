"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Shown on the 404 page for /jobs/<slug> (P6/A10). The public job page only
 * knows publicly visible jobs; a signed-in owner, admin or applicant gets a
 * link to the session-aware preview, which decides whether they may see it.
 */
export function JobPreviewHint() {
  const pathname = usePathname() ?? "";
  const { status } = useSession();
  const slug = /^\/jobs\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (!slug || status !== "authenticated") return null;
  return (
    <p className="mt-3 max-w-md text-slate-700">
      If you posted this job or applied to it,{" "}
      <Link href={`/jobs/${slug}/preview`} className="font-semibold text-brand-navy underline underline-offset-2">
        view it from your account
      </Link>
      .
    </p>
  );
}
