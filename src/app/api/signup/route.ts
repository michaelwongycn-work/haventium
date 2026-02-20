import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/password";
import { handleApiError } from "@/lib/api";
import { createXenditPaymentLink } from "@/lib/payment-gateways/xendit";
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

    const isPaid = price > 0;

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

    // If free tier, return credentials for client-side auto-login
    if (!isPaid) {
      return NextResponse.json(
        {
          message: "User registered successfully",
          redirect: "/dashboard",
          autoLogin: { email, password },
        },
        { status: 201 },
      );
    }

    // Paid tier: create Xendit payment link
    const haventiumXenditKey = process.env.HAVENTIUM_XENDIT_SECRET_KEY;
    if (!haventiumXenditKey) {
      // Xendit key not configured — treat as free, auto-login
      return NextResponse.json(
        {
          message: "User registered successfully",
          redirect: "/dashboard",
          autoLogin: { email, password },
        },
        { status: 201 },
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const externalId = `sub-${result.subscription.id}-${Date.now()}`;
    const xenditResult = await createXenditPaymentLink({
      apiKey: haventiumXenditKey,
      externalId,
      amount: price,
      payerEmail: email,
      description: `Haventium ${subscriptionTier.name} subscription (${billingCycle.toLowerCase()})`,
      currency: "IDR",
      successRedirectUrl: `${baseUrl}/signup/success`,
      failureRedirectUrl: `${baseUrl}/signup/payment-failed`,
    });

    // Create PaymentTransaction for the subscription
    await prisma.paymentTransaction.create({
      data: {
        organizationId: result.organization.id,
        subscriptionId: result.subscription.id,
        type: "SUBSCRIPTION",
        gateway: "XENDIT",
        externalId: xenditResult.externalId,
        xenditInvoiceId: xenditResult.xenditInvoiceId,
        paymentLinkUrl: xenditResult.paymentLinkUrl,
        amount: price,
        status: "PENDING",
        externalResponse: JSON.parse(JSON.stringify(xenditResult.externalResponse)),
      },
    });

    return NextResponse.json(
      {
        message: "User registered. Please complete payment.",
        paymentLinkUrl: xenditResult.paymentLinkUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "signup");
  }
}
