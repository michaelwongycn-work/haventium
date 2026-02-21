import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mailersend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;

    if (!email) {
      // Return generic success to prevent email enumeration
      return NextResponse.json({
        message: "If that email exists, a new verification link has been sent.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });

    // If user doesn't exist or already verified, return generic success silently
    if (!user || user.emailVerified) {
      return NextResponse.json({
        message: "If that email exists, a new verification link has been sent.",
      });
    }

    // Rate limit: check if a token was created less than 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        expires: { gt: oneHourAgo },
      },
      orderBy: { expires: "desc" },
    });

    // Check if the token was issued recently (within 1 hour)
    // if (recentToken) {
    //   const tokenIssuedAt = new Date(
    //     recentToken.expires.getTime() - 24 * 60 * 60 * 1000,
    //   );
    //   if (tokenIssuedAt > oneHourAgo) {
    //     return NextResponse.json(
    //       {
    //         error: "Please wait before requesting another verification email.",
    //       },
    //       { status: 429 },
    //     );
    //   }
    // }

    // Delete old tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // Create new token
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

    sendVerificationEmail({
      to: email,
      toName: user.name ?? email,
      token,
      baseUrl,
    }).catch((err) => {
      console.error("[resend-verification] Failed to send email:", err);
    });

    return NextResponse.json({
      message: "If that email exists, a new verification link has been sent.",
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
