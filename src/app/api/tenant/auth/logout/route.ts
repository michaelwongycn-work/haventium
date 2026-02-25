import { cookies } from "next/headers";
import { apiSuccess } from "@/lib/api";
import { TENANT_SESSION_COOKIE } from "@/lib/tenant-auth";

export async function POST(): Promise<Response> {
  const cookieStore = await cookies();
  cookieStore.delete(TENANT_SESSION_COOKIE);
  return apiSuccess({ success: true });
}
