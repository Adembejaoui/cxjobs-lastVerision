"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import { useSession } from "next-auth/react";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  isOnboarded: boolean;
}

interface UserState {
  user: UserData | null;
  /** "loading" only while the client session is being fetched. */
  status: "loading" | "ready";
}

const UserContext = createContext<UserState>({ user: null, status: "ready" });

/**
 * Two modes:
 *  - `user` given (server-rendered, e.g. onboarding): that value is used.
 *  - `user` omitted (public pages, launch plan A10): the user is read from
 *    the client session, so the public layout never reads cookies on the
 *    server and public pages can be statically cached for every visitor.
 */
export function UserProvider({ children, user }: { children: ReactNode; user?: UserData | null }) {
  const { data, status } = useSession();
  const value = useMemo<UserState>(() => {
    if (user !== undefined) return { user, status: "ready" };
    const s = data?.user;
    const fromSession: UserData | null = s?.id
      ? {
          id: s.id,
          name: s.name ?? null,
          email: s.email ?? "",
          image: s.image ?? null,
          role: s.role,
          isOnboarded: s.isOnboarded,
        }
      : null;
    return { user: fromSession, status: status === "loading" ? "loading" : "ready" };
  }, [user, data, status]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/** The signed-in user, or null (also null while the session is loading). */
export function useUser() {
  return useContext(UserContext).user;
}

/** User plus loading status, for pages that must not act before it is known. */
export function useUserState() {
  return useContext(UserContext);
}
