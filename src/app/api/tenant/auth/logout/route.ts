import { cookies } from "next/headers";
import { apiSuccess } from "@/lib/api";
import { TENANT_SESSION_COOKIE, verifyTenantSession, revokeTenantSession } from "@/lib/tenant-auth";

export async function POST(): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TENANT_SESSION_COOKIE)?.value;

  // Revoke the JWT server-side so it can't be reused even if the cookie is stolen
  if (token) {
    const session = await verifyTenantSession(token);
    if (session?.jti) {
      // Expire in 7 days (matches SESSION_EXPIRY)
      revokeTenantSession(session.jti, Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  cookieStore.delete(TENANT_SESSION_COOKIE);
  return apiSuccess({ success: true });
}
