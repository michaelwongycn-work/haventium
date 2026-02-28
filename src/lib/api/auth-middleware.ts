import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAccess } from "@/lib/access-utils";
import { apiForbidden, apiUnauthorized } from "./response";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Authentication Middleware Utilities
 * Standardized auth checks for API routes
 */

/**
 * Require authentication (no permission check)
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false as const,
      response: apiUnauthorized(),
      session: null,
    };
  }

  return {
    authorized: true as const,
    response: null,
    session,
  };
}

/**
 * Require specific resource access
 */
export async function requireAccess(resource: string, action: string) {
  const session = await auth();

  if (!session?.user?.organizationId) {
    return {
      authorized: false as const,
      response: apiUnauthorized(),
      session: null,
    };
  }

  // Use the core access logic
  const roles = session.user.roles || [];
  const authorized = hasAccess(roles, resource, action);

  if (!authorized) {
    return {
      authorized: false as const,
      response: apiForbidden(),
      session,
    };
  }

  return {
    authorized: true as const,
    response: null,
    session,
  };
}

/**
 * Check if the org's subscription tier includes a specific feature.
 * Call after requireAccess/requireAuth — pass the session from those.
 */
export async function requireFeature(
  organizationId: string,
  featureCode: string,
) {
  // Verify org has an active subscription on a tier that includes this feature.
  // We first look up the org's active subscription tier, then check feature inclusion —
  // this makes the org scope explicit rather than relying on nested relationship filtering.
  const activeSubscription = await prisma.subscription.findFirst({
    where: { organizationId, status: "ACTIVE" },
    select: { tierId: true },
  });

  if (!activeSubscription) {
    return {
      allowed: false as const,
      response: NextResponse.json(
        { error: "Your current plan does not include this feature" },
        { status: 403 },
      ),
    };
  }

  const tierFeature = await prisma.tierFeature.findFirst({
    where: {
      tierId: activeSubscription.tierId,
      feature: { code: featureCode },
    },
  });

  if (!tierFeature) {
    return {
      allowed: false as const,
      response: NextResponse.json(
        { error: "Your current plan does not include this feature" },
        { status: 403 },
      ),
    };
  }

  return { allowed: true as const, response: null };
}

/**
 * Verify cron job authorization
 */
export function verifyCronAuth(request: Request): {
  authorized: boolean;
  response?: NextResponse;
} {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRET is required - fail if not configured
  if (!cronSecret) {
    return {
      authorized: false,
      response: apiUnauthorized(
        "CRON_SECRET environment variable not configured",
      ),
    };
  }

  // Verify authorization header using timing-safe comparison
  if (!authHeader) {
    return {
      authorized: false,
      response: apiUnauthorized("Invalid cron secret"),
    };
  }
  const expected = `Bearer ${cronSecret}`;
  let tokensMatch = false;
  try {
    tokensMatch = crypto.timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(expected),
    );
  } catch {
    // Different lengths — tokens don't match
    tokensMatch = false;
  }

  if (!tokensMatch) {
    return {
      authorized: false,
      response: apiUnauthorized("Invalid cron secret"),
    };
  }

  return { authorized: true };
}
