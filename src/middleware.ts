import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/api/signup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/subscription-tiers");

  // If accessing a public route, allow
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If not authenticated and trying to access protected route, redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Email verification gate — must verify before accessing anything
  const emailVerified = (req.auth as { user?: { emailVerified?: boolean } })?.user?.emailVerified;
  if (!emailVerified) {
    const isAllowed =
      pathname.startsWith("/verify-email") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup");
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/verify-email", req.url));
    }
  }

  // Redirect PENDING_PAYMENT users to /subscribe (except allowed paths)
  const subscriptionStatus = (req.auth as { user?: { subscription?: { status?: string } } })?.user?.subscription?.status;
  if (subscriptionStatus === "PENDING_PAYMENT") {
    const isAllowed =
      pathname.startsWith("/subscribe") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup");
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/subscribe", req.url));
    }
  }

  // If authenticated, allow access
  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
