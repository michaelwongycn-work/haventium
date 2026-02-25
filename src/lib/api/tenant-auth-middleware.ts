import { cookies, headers } from "next/headers";
import { verifyTenantSession, TENANT_SESSION_COOKIE } from "@/lib/tenant-auth";
import { apiUnauthorized, apiForbidden } from "./response";

export interface TenantSession {
  tenantId: string;
  organizationId: string;
  email: string;
}

/**
 * Require tenant authentication for API routes.
 * Reads the tenant-session cookie, verifies JWT, and cross-checks
 * organizationId against the x-org-id header injected by middleware.
 */
export async function requireTenantAuth(): Promise<
  | { authorized: true; tenant: TenantSession }
  | { authorized: false; response: Response }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TENANT_SESSION_COOKIE)?.value;

  if (!token) {
    return { authorized: false, response: apiUnauthorized() };
  }

  const payload = await verifyTenantSession(token);
  if (!payload) {
    return { authorized: false, response: apiUnauthorized() };
  }

  // Cross-check org from JWT against x-org-id header injected by middleware
  const headerStore = await headers();
  const orgIdFromHeader = headerStore.get("x-org-id");
  if (orgIdFromHeader && orgIdFromHeader !== payload.organizationId) {
    return { authorized: false, response: apiForbidden() };
  }

  return {
    authorized: true,
    tenant: {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
      email: payload.email,
    },
  };
}
