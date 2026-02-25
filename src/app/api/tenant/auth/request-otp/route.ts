import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { generateOtp, hashOtp, sendOtpEmail, sendOtpWhatsApp, OTP_EXPIRY_MINUTES } from "@/lib/tenant-otp";

const schema = z.object({
  identifier: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const headerStore = await headers();
    const organizationId = headerStore.get("x-org-id");
    if (!organizationId) {
      return apiError("Organization not found", 404);
    }

    const body = await request.json();
    const { identifier } = schema.parse(body);

    // Auto-detect channel from identifier format
    const isEmail = identifier.includes("@");
    const channel = isEmail ? "EMAIL" : "WHATSAPP";

    // Find tenant — always return 200 to prevent enumeration
    const tenant = await prisma.tenant.findFirst({
      where: isEmail
        ? { email: identifier, organizationId }
        : { phone: identifier, organizationId },
      select: { id: true, fullName: true, email: true, phone: true },
    });

    if (!tenant) {
      // Silently succeed — no enumeration
      return apiSuccess({ success: true });
    }

    // Rate limit: block if OTP created in last 60s for this channel
    const recentToken = await prisma.tenantOtpToken.findFirst({
      where: {
        tenantId: tenant.id,
        channel,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });
    if (recentToken) {
      return apiError("Please wait before requesting another code", 429);
    }

    // Delete old tokens for this tenant+channel
    await prisma.tenantOtpToken.deleteMany({
      where: { tenantId: tenant.id, organizationId, channel },
    });

    // Create new OTP token
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await prisma.tenantOtpToken.create({
      data: {
        tenantId: tenant.id,
        organizationId,
        hashedToken: hashOtp(otp),
        channel,
        expiresAt,
      },
    });

    // Fetch org name for notification
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const orgName = org?.name ?? "Your Landlord";

    // Send OTP via detected channel
    if (channel === "EMAIL") {
      await sendOtpEmail({
        organizationId,
        orgName,
        to: tenant.email,
        toName: tenant.fullName,
        otp,
      });
    } else {
      await sendOtpWhatsApp({
        organizationId,
        phone: identifier,
        orgName,
        otp,
      });
    }

    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error, "request OTP");
  }
}
