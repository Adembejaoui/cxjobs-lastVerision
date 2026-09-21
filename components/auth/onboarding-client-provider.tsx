"use client";

import { UserProvider } from "@/components/auth/user-provider";

interface OnboardingClientProviderProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: string;
    isOnboarded: boolean;
  };
  children: React.ReactNode;
}

export function OnboardingClientProvider({ user, children }: OnboardingClientProviderProps) {
  return <UserProvider user={user}>{children}</UserProvider>;
}