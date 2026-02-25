import { SignJWT, jwtVerify } from "jose";

export const TENANT_SESSION_COOKIE = "tenant-session";
const SESSION_EXPIRY = "7d";

export interface TenantSessionPayload {
  tenantId: string;
  organizationId: string;
  email: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required");
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT for a tenant session
 */
export async function createTenantSession(
  payload: TenantSessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(getSecret());
}

/**
 * Verify and decode a tenant session JWT
 */
export async function verifyTenantSession(
  token: string,
): Promise<TenantSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { tenantId, organizationId, email } = payload as Record<
      string,
      unknown
    >;
    if (
      typeof tenantId !== "string" ||
      typeof organizationId !== "string" ||
      typeof email !== "string"
    ) {
      return null;
    }
    return { tenantId, organizationId, email };
  } catch {
    return null;
  }
}
