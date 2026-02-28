import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifyXenditWebhook } from "@/lib/payment-gateways/xendit";

// POST /api/webhooks/xendit
// Handles Xendit webhooks for SUBSCRIPTION payments only.
// Token verified against HAVENTIUM_XENDIT_WEBHOOK_TOKEN env var.

// In-memory rate limiter: max 30 verification failures per IP per minute.
// Use Redis in production for distributed deployments.
const failureTracker = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = failureTracker.get(ip);
  if (!entry || entry.resetAt < now) {
    failureTracker.set(ip, { count: 0, resetAt: now + 60_000 });
    return false;
  }
  return entry.count >= 30;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = failureTracker.get(ip);
  if (!entry || entry.resetAt < now) {
    failureTracker.set(ip, { count: 1, resetAt: now + 60_000 });
  } else {
    entry.count++;
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (isRateLimited(ip)) {
      logger.error("Xendit subscription webhook: rate limit exceeded", null, { ip });
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const callbackToken = request.headers.get("x-callback-token") ?? "";
    const webhookToken = process.env.HAVENTIUM_XENDIT_WEBHOOK_TOKEN ?? "";

    if (!verifyXenditWebhook(callbackToken, webhookToken)) {
      recordFailure(ip);
      logger.error("Xendit subscription webhook: invalid callback token", null, {});
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status, external_id } = body;

    if (status !== "PAID") {
      return NextResponse.json({ received: true });
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { externalId: external_id },
    });

    if (!transaction) {
      logger.info("Xendit subscription webhook: transaction not found", { externalId: external_id });
      return NextResponse.json({ received: true });
    }

    if (transaction.status === "COMPLETED") {
      return NextResponse.json({ received: true });
    }

    if (transaction.type !== "SUBSCRIPTION") {
      logger.info("Xendit subscription webhook: transaction is not a subscription", {
        externalId: external_id,
        type: transaction.type,
      });
      return NextResponse.json({ received: true });
    }

    await handleSubscriptionPayment(transaction, body);

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Xendit subscription webhook error", error, {});
    return NextResponse.json({ received: true });
  }
}

async function handleSubscriptionPayment(
  transaction: {
    id: string;
    subscriptionId: string | null;
    organizationId: string;
  },
  body: Record<string, unknown>,
) {
  if (!transaction.subscriptionId) return;

  const subscription = await prisma.subscription.findUnique({
    where: { id: transaction.subscriptionId },
    include: { tier: true },
  });

  if (!subscription) return;

  const now = new Date();
  // If renewing early (still ACTIVE), extend from current period end; otherwise from now
  const baseDate =
    subscription.status === "ACTIVE" && subscription.endDate > now
      ? new Date(subscription.endDate)
      : new Date(now);
  const periodEnd = new Date(baseDate);
  if (subscription.billingCycle === "ANNUAL") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "COMPLETED",
        paidAt: now,
        webhookReceivedAt: now,
        externalResponse: JSON.parse(JSON.stringify(body)),
      },
    });

    await tx.subscription.update({
      where: { id: transaction.subscriptionId! },
      data: {
        status: "ACTIVE",
        startDate: baseDate,
        endDate: periodEnd,
      },
    });
  });

  logger.info("Subscription payment completed", {
    subscriptionId: transaction.subscriptionId,
    organizationId: transaction.organizationId,
  });
}
