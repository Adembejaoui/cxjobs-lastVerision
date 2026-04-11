import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedRoutes = ["/dashboard", "/admin"];
const authRoutes = ["/login", "/register"];
const onboardingRoutes = ["/onboarding"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const token = await getToken({ 
    req: request, 
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET 
  });
  const isAuthenticated = !!token;
  const isCandidate = token?.role === "CANDIDATE";
  const isOnboarded = token?.isOnboarded === true;
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname === route);
  const isOnboardingRoute = pathname.startsWith("/onboarding");

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isCandidate && !isOnboarded) {
    if (!isOnboardingRoute) {
      return NextResponse.redirect(new URL("/onboarding/candidate", request.url));
    }
    return response;
  }

  if (isCandidate && isOnboarded && isOnboardingRoute) {
    return NextResponse.redirect(new URL("/dashboard/candidate", request.url));
  }

  if (pathname === "/dashboard" && isAuthenticated) {
    const role = token?.role;
    if (role === "COMPANY") {
      return NextResponse.redirect(new URL("/dashboard/company", request.url));
    } else if (role === "CANDIDATE" && isOnboarded) {
      return NextResponse.redirect(new URL("/dashboard/candidate", request.url));
    }
  }

  if (pathname.startsWith("/dashboard/company") && token?.role !== "COMPANY") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/dashboard/candidate") && token?.role !== "CANDIDATE") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
