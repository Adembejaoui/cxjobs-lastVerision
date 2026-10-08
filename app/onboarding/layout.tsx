import { auth } from "@/lib/auth";
import { OnboardingClientProvider } from "@/components/auth/onboarding-client-provider";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const user = session?.user?.id
    ? {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email,
        image: session.user.image ?? null,
        role: session.user.role,
        isOnboarded: session.user.isOnboarded,
      }
    : null;

  return <OnboardingClientProvider user={user}>{children}</OnboardingClientProvider>;
}
