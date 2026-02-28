import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Internal route: resolve an organization from a host string.
 * Called by middleware to avoid Prisma in the middleware layer.
 * Protected by INTERNAL_API_SECRET header — not accessible to external clients.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const requestSecret = (request as Request & { headers: Headers }).headers.get("x-internal-secret");

  let authorized = false;
  if (internalSecret && requestSecret) {
    try {
      authorized = crypto.timingSafeEqual(Buffer.from(internalSecret), Buffer.from(requestSecret));
    } catch {
      authorized = false;
    }
  }
  if (!authorized) {
    return NextResponse.json({ orgId: null }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const host = searchParams.get("host");

  if (!host) {
    return NextResponse.json({ orgId: null });
  }

  const hostname = host.split(":")[0];
  const mainHostname = (process.env.PUBLIC_HOSTNAME ?? "haventium.com").split(
    ":",
  )[0];

  let org: { id: string } | null = null;

  if (hostname.endsWith(`.${mainHostname}`)) {
    const subdomain = hostname.slice(0, -(mainHostname.length + 1));
    org = await prisma.organization.findUnique({
      where: { subdomain },
      select: { id: true },
    });
  }

  return NextResponse.json({ orgId: org?.id ?? null });
}
