"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Welcome! Let&apos;s set up your profile</h1>
            <p className="text-sm text-gray-600">How would you like to complete your candidate profile?</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => router.push("/onboarding/candidate/manual")}
              className="p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-center"
            >
              <div className="text-4xl mb-3">📝</div>
              <div className="text-lg font-semibold text-gray-900 mb-2">I&apos;ll fill it manually</div>
              <div className="text-sm text-gray-600">Enter your details step by step</div>
            </button>

            <button
              type="button"
              onClick={() => router.push("/onboarding/candidate/cv")}
              className="p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-green-400 hover:bg-green-50 transition-all duration-200 text-center"
            >
              <div className="text-4xl mb-3">📄</div>
              <div className="text-lg font-semibold text-gray-900 mb-2">Upload my CV</div>
              <div className="text-sm text-gray-600">Extract data from PDF automatically</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}