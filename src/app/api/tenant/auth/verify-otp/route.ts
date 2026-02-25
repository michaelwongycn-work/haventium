import { z } from "zod";
import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { hashOtp } from "@/lib/tenant-otp";
import { createTenantSession, TENANT_SESSION_COOKIE } from "@/lib/tenant-auth";

const schema = z.object({
  identifier: z.string().min(1),
  otp: z.string().length(6),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const headerStore = await headers();
    const organizationId = headerStore.get("x-org-id");
    if (!organizationId) {
      return apiError("Organization not found", 404);
    }

    const body = await request.json();
    const { identifier, otp } = schema.parse(body);

    // Auto-detect channel from identifier format
    const isEmail = identifier.includes("@");

    // Find tenant
    const tenant = await prisma.tenant.findFirst({
      where: isEmail
        ? { email: identifier, organizationId }
        : { phone: identifier, organizationId },
      select: { id: true, email: true, fullName: true },
    });

    if (!tenant) {
      return apiError("Invalid code", 400);
    }

    // Find matching token for any channel
    const hashedToken = hashOtp(otp);
    const tokenRecord = await prisma.tenantOtpToken.findFirst({
      where: {
        tenantId: tenant.id,
        organizationId,
        hashedToken,
        usedAt: null,
        expiresAt: { gte: new Date() },
      },
    });

    if (!tokenRecord) {
      return apiError("Invalid or expired code", 400);
    }

    // Mark token as used
    await prisma.tenantOtpToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    });

    // Create JWT session
    const jwt = await createTenantSession({
      tenantId: tenant.id,
      organizationId,
      email: tenant.email,
    });

    // Log activity
    await prisma.activity.create({
      data: {
        organizationId,
        type: "TENANT_PORTAL_LOGIN",
        description: `Tenant ${tenant.fullName} logged in to tenant portal`,
        tenantId: tenant.id,
      },
    });

    // Set cookie
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";
    cookieStore.set(TENANT_SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error, "verify OTP");
  }
}
