import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { validateInvitationToken } from "@/lib/server/invitation-validation";
import SignupForm from "@/components/auth/signup-form";

interface InvitationErrorProps {
  error: string;
  code: string;
}

function InvitationError({ error, code }: InvitationErrorProps) {
  const isMissing = code === "TOKEN_MISSING";

  return (
    <div className="min-h-screen bg-[#F8F9FB] py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-[16px] shadow-sm border border-[#E5E7EB] p-8 text-center">
          <div className="w-12 h-12 mx-auto bg-[#FEF2F2] rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-[#DC2626]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v3.75m9-.75A9 9 0 111.5 12c0 1.269.515 2.427 1.345 3.267L12 21l5.155-5.733C18.485 14.427 19.5 13.269 19.5 12z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#111827] mb-2">
            {isMissing ? "No Invitation Token" : "Invitation Unavailable"}
          </h1>
          <p className="text-[#6B7280] mb-6">{error}</p>
        </div>
      </div>
    </div>
  );
}

export default async function CompanyOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const session = await auth();
  const isAuthenticated = !!session?.user?.id;

  // Invitation registration with token
  if (token) {
    // Redirect already-authenticated users to dashboard
    if (isAuthenticated) {
      redirect("/dashboard");
    }

    const result = await validateInvitationToken(token);

    if (!result.success) {
      return <InvitationError error={result.error} code={result.code} />;
    }

    const invitation = result.data;

    return (
      <div className="min-h-screen bg-[#F8F9FB] py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-[16px] shadow-sm border border-[#E5E7EB] p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#111827] mb-2">
                Create your company account
              </h1>
              <p className="text-[#6B7280]">
                You&apos;ve been invited to create a company account for{" "}
                <span className="font-semibold text-[#111827]">
                  {invitation.companyName}
                </span>
                .
              </p>
            </div>

            <SignupForm
              defaultFullName={invitation.managerName ?? ""}
              defaultEmail={invitation.managerEmail ?? ""}
              invitationToken={token}
              isInvitationMode={true}
            />
          </div>
        </div>
      </div>
    );
  }

  // No token: redirect to the company profile page
  if (!isAuthenticated) {
    redirect("/login");
  }

  redirect("/dashboard/company/profile");
}
