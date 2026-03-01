import { SignJWT, jwtVerify } from "jose";

export const TENANT_SESSION_COOKIE = "tenant-session";
const SESSION_EXPIRY = "7d";

export interface TenantSessionPayload {
  tenantId: string;
  organizationId: string;
  email: string;
  jti: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required");
  return new TextEncoder().encode(secret);
}

// In-memory revocation set. Entries are pruned lazily.
// For multi-instance deployments, replace with a shared store (e.g. Redis).
const revokedJtis = new Map<string, number>(); // jti → expiry timestamp (ms)

/**
 * Revoke a tenant session by its JWT ID.
 * Should be called on logout and when sessions must be force-invalidated.
 */
export function revokeTenantSession(jti: string, expiresAt: number): void {
  revokedJtis.set(jti, expiresAt);
  // Prune expired entries
  const now = Date.now();
  for (const [id, exp] of revokedJtis) {
    if (exp < now) revokedJtis.delete(id);
  }
}

/**
 * Create a signed JWT for a tenant session
 */
export async function createTenantSession(
  payload: Omit<TenantSessionPayload, "jti">,
): Promise<string> {
  const jti = globalThis.crypto.randomUUID();
  return new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .setJti(jti)
    .sign(getSecret());
}

/**
 * Verify and decode a tenant session JWT.
 * Returns null if the token is invalid, expired, or revoked.
 */
export async function verifyTenantSession(
  token: string,
): Promise<TenantSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { tenantId, organizationId, email, jti } = payload as Record<
      string,
      unknown
    >;
    if (
      typeof tenantId !== "string" ||
      typeof organizationId !== "string" ||
      typeof email !== "string" ||
      typeof jti !== "string"
    ) {
      return null;
    }
    // Reject revoked sessions
    if (revokedJtis.has(jti)) {
      return null;
    }
    return { tenantId, organizationId, email, jti };
  } catch {
    return null;
  }
}
