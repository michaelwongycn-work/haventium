import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/password";
import { handleApiError } from "@/lib/api";
import { sendVerificationEmail } from "@/lib/mailersend";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  tier: z.enum(["FREE", "NORMAL", "PRO"]),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = signupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { email, password, name, organizationName, tier, billingCycle } =
      validation.data;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: "Password validation failed",
          details: passwordValidation.errors,
        },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 },
      );
    }

    // Get the subscription tier
    const subscriptionTier = await prisma.subscriptionTier.findUnique({
      where: { type: tier },
    });

    if (!subscriptionTier) {
      return NextResponse.json(
        { error: "Invalid subscription tier" },
        { status: 400 },
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Determine price based on billing cycle
    const price =
      billingCycle === "ANNUAL"
        ? Number(subscriptionTier.annualPrice)
        : Number(subscriptionTier.monthlyPrice);

    const isPaid = price > 0; // Used for subscription status: PENDING_PAYMENT vs ACTIVE

    // Create organization, user, subscription, and default role in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email,
          name,
          hashedPassword,
          organizationId: organization.id,
        },
      });

      // Create subscription
      const now = new Date();
      const far = new Date("2099-12-31");

      const subscription = await tx.subscription.create({
        data: {
          organizationId: organization.id,
          tierId: subscriptionTier.id,
          status: isPaid ? "PENDING_PAYMENT" : "ACTIVE",
          billingCycle,
          startDate: now,
          endDate: isPaid ? now : far,
          currentPeriodStart: now,
          currentPeriodEnd: isPaid ? now : far,
        },
      });

      // Create default "Owner" role
      const ownerRole = await tx.role.create({
        data: {
          name: "Owner",
          isSystem: true,
          organizationId: organization.id,
        },
      });

      // Assign user to Owner role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
        },
      });

      // Fetch all existing accesses and assign to Owner role
      const allAccesses = await tx.access.findMany();

      if (allAccesses.length > 0) {
        await tx.roleAccess.createMany({
          data: allAccesses.map((access: { id: string }) => ({
            roleId: ownerRole.id,
            accessId: access.id,
          })),
        });
      }

      return { user, organization, subscription };
    });

    // Generate email verification token
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

    // Send verification email non-blocking
    sendVerificationEmail({
      to: email,
      toName: name,
      token,
      baseUrl,
    }).catch((err) => {
      console.error("[signup] Failed to send verification email:", err);
    });

    // Both FREE and PAID: auto-login and redirect to verify-email
    return NextResponse.json(
      {
        message: "User registered successfully. Please verify your email.",
        redirect: "/verify-email",
        autoLogin: { email, password },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "signup");
  }
}
