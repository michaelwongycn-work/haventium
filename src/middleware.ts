import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { SubscriptionStatus } from "@prisma/client";
import { verifyTenantSession, TENANT_SESSION_COOKIE } from "@/lib/tenant-auth";

const { auth } = NextAuth(authConfig);

// ========================================
// Org resolution cache (5-min TTL)
// ========================================

interface OrgCacheEntry {
  orgId: string | null;
  expiresAt: number;
}

const orgCache = new Map<string, OrgCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveOrgFromHost(host: string): Promise<string | null> {
  const cached = orgCache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.orgId;
  }

  try {
    // Call internal API to resolve org — avoids Prisma in middleware edge issues
    const baseUrl = process.env.PUBLIC_URL ?? "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/internal/resolve-org?host=${encodeURIComponent(host)}`,
      {
        cache: "no-store",
        headers: {
          "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
        },
      },
    );
    if (!response.ok) {
      orgCache.set(host, { orgId: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }
    const data = (await response.json()) as { orgId: string | null };
    orgCache.set(host, {
      orgId: data.orgId,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return data.orgId;
  } catch (err) {
    console.error("[middleware] Failed to resolve org from host", host, err);
    return null;
  }
}

function getMainHostname(): string {
  return process.env.PUBLIC_HOSTNAME ?? "haventium.com";
}

function extractSubdomain(host: string): string | null {
  // Strip port if present
  const hostname = host.split(":")[0];
  const mainHostname = getMainHostname().split(":")[0];

  if (hostname.endsWith(`.${mainHostname}`)) {
    return hostname.slice(0, -(mainHostname.length + 1));
  }
  return null;
}

function isSubdomainRequest(host: string): boolean {
  return extractSubdomain(host) !== null;
}

// ========================================
// Main middleware
// ========================================

export default auth(async (req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  const isTenantHost = isSubdomainRequest(host);

  // ----------------------------------------
  // Resolve org for tenant-facing hosts
  // ----------------------------------------
  let orgId: string | null = null;
  if (isTenantHost) {
    orgId = await resolveOrgFromHost(host);
  }

  // ----------------------------------------
  // Tenant host routing
  // ----------------------------------------
  if (isTenantHost) {
    // Inject org id for downstream handlers
    const requestHeaders = new Headers(req.headers);
    if (orgId) {
      requestHeaders.set("x-org-id", orgId);
    }

    // If org not found, show 404-style
    if (!orgId) {
      return new NextResponse("Organization not found", { status: 404 });
    }

    // Public tenant paths — allow through
    const isTenantPublic =
      pathname.startsWith("/tenant/login") ||
      pathname.startsWith("/tenant/verify") ||
      pathname.startsWith("/api/tenant/auth/");

    if (isTenantPublic) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Redirect non-tenant paths on tenant host to portal dashboard
    if (
      !pathname.startsWith("/tenant/") &&
      !pathname.startsWith("/api/tenant/")
    ) {
      return NextResponse.redirect(new URL("/tenant/dashboard", req.url));
    }

    // Protected tenant paths — verify session
    const token = req.cookies.get(TENANT_SESSION_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/tenant/login", req.url));
    }

    const session = await verifyTenantSession(token);
    if (!session) {
      return NextResponse.redirect(new URL("/tenant/login", req.url));
    }

    // Cross-check session org matches resolved org
    if (session.organizationId !== orgId) {
      const loginUrl = new URL("/tenant/login", req.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(TENANT_SESSION_COOKIE);
      return response;
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ----------------------------------------
  // Admin (main hostname) routing — unchanged logic
  // ----------------------------------------

  // Public routes
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/api/signup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/subscription-tiers") ||
    pathname.startsWith("/api/internal/");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const adminAuth = (req as unknown as { auth: unknown }).auth;

  if (!adminAuth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Email verification gate
  const emailVerified = (adminAuth as { user?: { emailVerified?: boolean } })
    ?.user?.emailVerified;
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

  // PENDING_PAYMENT / EXPIRED gate — redirect to /subscribe until they pay
  const subscriptionStatus = (
    adminAuth as { user?: { subscription?: { status?: SubscriptionStatus } } }
  )?.user?.subscription?.status;
  const isPaymentRequired =
    subscriptionStatus === ("PENDING_PAYMENT" as SubscriptionStatus) ||
    subscriptionStatus === ("EXPIRED" as SubscriptionStatus);
  if (isPaymentRequired) {
    const isAllowed =
      pathname.startsWith("/subscribe") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup");
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/subscribe", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
