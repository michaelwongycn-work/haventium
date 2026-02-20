import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifyXenditWebhook } from "@/lib/payment-gateways/xendit";
import { generateReceipt } from "@/lib/receipt-generator";
import { processNotifications } from "@/lib/services/notification-processor";

// Map Xendit payment methods to our PaymentMethod enum
function mapPaymentMethod(
  xenditMethod?: string,
): "CASH" | "BANK_TRANSFER" | "VIRTUAL_ACCOUNT" | "QRIS" | "MANUAL" {
  if (!xenditMethod) return "MANUAL";
  const method = xenditMethod.toUpperCase();
  if (method.includes("VIRTUAL_ACCOUNT") || method.includes("VA"))
    return "VIRTUAL_ACCOUNT";
  if (method.includes("QRIS") || method.includes("QR")) return "QRIS";
  if (method.includes("BANK") || method.includes("TRANSFER"))
    return "BANK_TRANSFER";
  return "MANUAL";
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook token
    const callbackToken = request.headers.get("x-callback-token") ?? "";
    const webhookToken = process.env.XENDIT_WEBHOOK_TOKEN ?? "";

    if (!verifyXenditWebhook(callbackToken, webhookToken)) {
      logger.error("Xendit webhook: invalid callback token", null, {});
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status, external_id, payment_method } = body;

    // Only process PAID events
    if (status !== "PAID") {
      return NextResponse.json({ received: true });
    }

    // Find the PaymentTransaction
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { externalId: external_id },
    });

    if (!transaction) {
      // Unknown transaction — log and return 200 (don't fail)
      logger.info("Xendit webhook: transaction not found", {
        externalId: external_id,
      });
      return NextResponse.json({ received: true });
    }

    // Idempotency: already completed
    if (transaction.status === "COMPLETED") {
      return NextResponse.json({ received: true });
    }

    const now = new Date();

    if (transaction.type === "RENT") {
      await handleRentPayment(transaction, body, payment_method, now);
    } else if (transaction.type === "SUBSCRIPTION") {
      await handleSubscriptionPayment(transaction, body, now);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Xendit webhook error", error, {});
    // Always return 200 to Xendit so they don't retry
    return NextResponse.json({ received: true });
  }
}

async function handleRentPayment(
  transaction: {
    id: string;
    leaseId: string | null;
    organizationId: string;
    amount: { toString: () => string };
  },
  body: Record<string, unknown>,
  paymentMethod: string | undefined,
  now: Date,
) {
  if (!transaction.leaseId) return;

  const leaseId = transaction.leaseId;
  const organizationId = transaction.organizationId;

  // Fetch full lease for receipt generation
  const lease = await prisma.leaseAgreement.findFirst({
    where: { id: leaseId, organizationId },
    include: {
      tenant: { select: { fullName: true, email: true } },
      unit: { include: { property: { select: { name: true } } } },
    },
  });

  if (!lease) {
    logger.error(
      "Xendit webhook: lease not found for transaction",
      null,
      { transactionId: transaction.id, leaseId },
    );
    return;
  }

  // Fetch org for currency/name
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, currency: true, currencySymbol: true },
  });

  // Update in a transaction
  await prisma.$transaction(async (tx) => {
    // Update PaymentTransaction
    await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "COMPLETED",
        paidAt: now,
        webhookReceivedAt: now,
        externalResponse: JSON.parse(JSON.stringify(body)),
      },
    });

    // Update LeaseAgreement
    await tx.leaseAgreement.update({
      where: { id: leaseId },
      data: {
        paidAt: now,
        paymentDate: now,
        paymentMethod: mapPaymentMethod(paymentMethod),
        paymentStatus: "COMPLETED",
        status: "ACTIVE",
        externalId: transaction.id,
        externalResponse: JSON.parse(JSON.stringify(body)),
      },
    });

    // Update tenant to ACTIVE
    await tx.tenant.update({
      where: { id: lease.tenantId },
      data: { status: "ACTIVE" },
    });
  });

  // Log activity (non-blocking)
  try {
    await prisma.activity.create({
      data: {
        type: "PAYMENT_WEBHOOK_RECEIVED",
        description: `Payment received via Xendit for lease (${lease.unit.property.name} / ${lease.unit.name})`,
        organizationId,
        leaseId,
        tenantId: lease.tenantId,
      },
    });
  } catch (e) {
    logger.error("Failed to log PAYMENT_WEBHOOK_RECEIVED activity", e, {
      transactionId: transaction.id,
    });
  }

  // Generate receipt PDF (non-blocking, best-effort)
  try {
    const receipt = await generateReceipt({
      transactionId: transaction.id,
      organizationName: org?.name ?? "Haventium",
      tenantName: lease.tenant.fullName,
      propertyName: lease.unit.property.name,
      unitName: lease.unit.name,
      leaseStartDate: lease.startDate.toLocaleDateString(),
      leaseEndDate: lease.endDate.toLocaleDateString(),
      amount: transaction.amount.toString(),
      currency: org?.currencySymbol ?? "$",
      paidAt: now.toLocaleString(),
    });

    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        receiptUrl: receipt.url,
        receiptStorageKey: receipt.storageKey,
      },
    });

    await prisma.activity.create({
      data: {
        type: "RECEIPT_GENERATED",
        description: `Receipt generated for lease payment (${lease.unit.property.name} / ${lease.unit.name})`,
        organizationId,
        leaseId,
        tenantId: lease.tenantId,
      },
    });
  } catch (e) {
    logger.error("Failed to generate receipt", e, {
      transactionId: transaction.id,
    });
  }

  // Fire PAYMENT_CONFIRMED notification (non-blocking)
  try {
    await processNotifications({
      organizationId,
      trigger: "PAYMENT_CONFIRMED",
      relatedEntityId: leaseId,
    });
  } catch (e) {
    logger.error("Failed to send PAYMENT_CONFIRMED notification", e, {
      leaseId,
    });
  }
}

async function handleSubscriptionPayment(
  transaction: {
    id: string;
    subscriptionId: string | null;
    organizationId: string;
  },
  body: Record<string, unknown>,
  now: Date,
) {
  if (!transaction.subscriptionId) return;

  const subscription = await prisma.subscription.findUnique({
    where: { id: transaction.subscriptionId },
    include: { tier: true },
  });

  if (!subscription) return;

  // Calculate period end based on billing cycle
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
