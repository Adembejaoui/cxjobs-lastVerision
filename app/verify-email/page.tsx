import type { Metadata } from "next";
import { VerifyEmailPanel } from "@/components/auth/token-flow-forms";

export const metadata: Metadata = {
  title: "Verify email | CXJobs",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// The token is in the URL fragment and is read client-side only: the server
// never receives it, so this page needs no request data and can be static.
export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <VerifyEmailPanel />
    </main>
  );
}
