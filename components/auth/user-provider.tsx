"use client";

import { createContext, useContext, ReactNode } from "react";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  isOnboarded: boolean;
}

const UserContext = createContext<UserData | null>(null);

export function UserProvider({ children, user }: { children: ReactNode; user: UserData | null }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}