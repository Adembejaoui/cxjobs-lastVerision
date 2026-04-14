import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/admin"];
const authRoutes = ["/login", "/register"];
const onboardingRoutes = ["/onboarding"];

function decodeToken(token: string): { role?: string; isOnboarded?: boolean } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const sessionToken = request.cookies.get("next-auth.session-token")?.value 
    || request.cookies.get("authjs.session-token")?.value;
  
  const token = sessionToken ? decodeToken(sessionToken) : null;
  const isAuthenticated = !!token;
  const isOnboarded = token?.isOnboarded === true;
  const role = token?.role;
  
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname === route);
  const isOnboardingRoute = pathname.startsWith("/onboarding");

  const response = NextResponse.next();

  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (role === "CANDIDATE" && !isOnboarded && !isOnboardingRoute) {
    return NextResponse.redirect(new URL("/onboarding/candidate", request.url));
  }

  if (role === "CANDIDATE" && isOnboarded && isOnboardingRoute) {
    return NextResponse.redirect(new URL("/dashboard/candidate", request.url));
  }

  if (pathname === "/dashboard" && isAuthenticated) {
    if (role === "COMPANY") {
      return NextResponse.redirect(new URL("/dashboard/company", request.url));
    } else if (role === "CANDIDATE" && isOnboarded) {
      return NextResponse.redirect(new URL("/dashboard/candidate", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};