import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAccess } from "@/lib/access-utils";
import { apiForbidden, apiUnauthorized } from "./response";

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
 * Re-implementation of checkAccess with standardized responses
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
 * @deprecated Use requireAccess instead
 */
export const checkAccess = requireAccess;

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

  // Verify authorization header matches the secret
  if (authHeader !== `Bearer ${cronSecret}`) {
    return {
      authorized: false,
      response: apiUnauthorized("Invalid cron secret"),
    };
  }

  return { authorized: true };
}
