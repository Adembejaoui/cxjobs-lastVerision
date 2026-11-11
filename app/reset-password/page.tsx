import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/token-flow-forms";

// Defence in depth: never send a Referer from this page and never index it.
export const metadata: Metadata = {
  title: "Reset password | CXJobs",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// The token is in the URL fragment and is read client-side only: the server
// never receives it, so this page needs no request data and can be static.
export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <ResetPasswordForm />
    </main>
  );
}
