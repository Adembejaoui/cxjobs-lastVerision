import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/token-flow-forms";

export const metadata: Metadata = {
  title: "Forgot password | CXJobs",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <ForgotPasswordForm />
    </main>
  );
}
