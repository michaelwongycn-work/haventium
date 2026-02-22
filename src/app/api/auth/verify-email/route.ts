import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid_token", request.url),
    );
  }

  // Look up the token
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken) {
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid_token", request.url),
    );
  }

  // Timing-safe comparison to prevent timing attacks on token lookup
  const tokenBuf = Buffer.from(token);
  const storedBuf = Buffer.from(verificationToken.token);
  const tokensMatch =
    tokenBuf.length === storedBuf.length &&
    timingSafeEqual(tokenBuf, storedBuf);
  if (!tokensMatch) {
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid_token", request.url),
    );
  }

  if (verificationToken.expires < new Date()) {
    try {
      await prisma.verificationToken.delete({ where: { token } });
    } catch (error) {
      logger.error("Failed to delete expired verification token", error, {
        token: "[REDACTED]",
      });
    }
    return NextResponse.redirect(
      new URL("/verify-email?error=expired_token", request.url),
    );
  }

  const email = verificationToken.identifier;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      organization: {
        select: {
          subscription: {
            select: { status: true },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid_token", request.url),
    );
  }

  // Verify email and delete token atomically
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  // Determine where to send the user after they sign in
  const subscriptionStatus = user.organization.subscription?.status;
  const next =
    subscriptionStatus === "PENDING_PAYMENT" ? "subscribe" : "dashboard";

  return NextResponse.redirect(
    new URL(`/verify-email?verified=true&next=${next}`, request.url),
  );
}
