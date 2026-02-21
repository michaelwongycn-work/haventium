import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  if (verificationToken.expires < new Date()) {
    // Clean up expired token
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
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
