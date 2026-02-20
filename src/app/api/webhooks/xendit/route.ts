import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifyXenditWebhook } from "@/lib/payment-gateways/xendit";

// POST /api/webhooks/xendit
// Handles Xendit webhooks for SUBSCRIPTION payments only.
// Token verified against HAVENTIUM_XENDIT_WEBHOOK_TOKEN env var.

export async function POST(request: NextRequest) {
  try {
    const callbackToken = request.headers.get("x-callback-token") ?? "";
    const webhookToken = process.env.HAVENTIUM_XENDIT_WEBHOOK_TOKEN ?? "";

    if (!verifyXenditWebhook(callbackToken, webhookToken)) {
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
  const periodEnd = new Date(now);
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
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startDate: now,
        endDate: periodEnd,
      },
    });
  });

  logger.info("Subscription payment completed", {
    subscriptionId: transaction.subscriptionId,
    organizationId: transaction.organizationId,
  });
}
