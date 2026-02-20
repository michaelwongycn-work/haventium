import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { decrypt } from "@/lib/encryption";
import { verifyXenditWebhook } from "@/lib/payment-gateways/xendit";
import { generateReceipt } from "@/lib/receipt-generator";
import { processNotifications } from "@/lib/services/notification-processor";

// POST /api/webhooks/xendit/rent
// Handles Xendit webhooks for RENT payments only.
// Token verified against the org's Xendit webhook token stored in the ApiKey table (service = XENDIT).
// The org is identified via the external_id, used to look up the PaymentTransaction → organizationId.

function mapPaymentMethod(
  xenditMethod?: string,
): "CASH" | "BANK_TRANSFER" | "VIRTUAL_ACCOUNT" | "QRIS" | "MANUAL" {
  if (!xenditMethod) return "MANUAL";
  const method = xenditMethod.toUpperCase();
  if (method.includes("VIRTUAL_ACCOUNT") || method.includes("VA")) return "VIRTUAL_ACCOUNT";
  if (method.includes("QRIS") || method.includes("QR")) return "QRIS";
  if (method.includes("BANK") || method.includes("TRANSFER")) return "BANK_TRANSFER";
  return "MANUAL";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { status, external_id, payment_method } = body;

    if (status !== "PAID") {
      return NextResponse.json({ received: true });
    }

    // Find the transaction to get the organizationId
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { externalId: external_id },
    });

    if (!transaction) {
      logger.info("Xendit rent webhook: transaction not found", { externalId: external_id });
      return NextResponse.json({ received: true });
    }

    if (transaction.status === "COMPLETED") {
      return NextResponse.json({ received: true });
    }

    if (transaction.type !== "RENT") {
      logger.info("Xendit rent webhook: transaction is not a rent payment", {
        externalId: external_id,
        type: transaction.type,
      });
      return NextResponse.json({ received: true });
    }

    // Look up org's Xendit API key to get the webhook token
    const xenditApiKey = await prisma.apiKey.findUnique({
      where: {
        organizationId_service: {
          organizationId: transaction.organizationId,
          service: "XENDIT",
        },
      },
    });

    if (!xenditApiKey || !xenditApiKey.isActive) {
      logger.error("Xendit rent webhook: no active Xendit API key for org", null, {
        organizationId: transaction.organizationId,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callbackToken = request.headers.get("x-callback-token") ?? "";
    const storedJson = decrypt(
      xenditApiKey.encryptedValue,
      xenditApiKey.encryptionIv,
      xenditApiKey.encryptionTag,
    );
    const { webhookToken } = JSON.parse(storedJson) as { secretKey: string; webhookToken: string };

    if (!verifyXenditWebhook(callbackToken, webhookToken)) {
      logger.error("Xendit rent webhook: invalid callback token", null, {
        organizationId: transaction.organizationId,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await handleRentPayment(transaction, body, payment_method);

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Xendit rent webhook error", error, {});
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
) {
  if (!transaction.leaseId) return;

  const leaseId = transaction.leaseId;
  const organizationId = transaction.organizationId;
  const now = new Date();

  const lease = await prisma.leaseAgreement.findFirst({
    where: { id: leaseId, organizationId },
    include: {
      tenant: { select: { fullName: true, email: true } },
      unit: { include: { property: { select: { name: true } } } },
    },
  });

  if (!lease) {
    logger.error("Xendit rent webhook: lease not found for transaction", null, {
      transactionId: transaction.id,
      leaseId,
    });
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, currency: true, currencySymbol: true },
  });

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

    await tx.tenant.update({
      where: { id: lease.tenantId },
      data: { status: "ACTIVE" },
    });
  });

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
    logger.error("Failed to log PAYMENT_WEBHOOK_RECEIVED activity", e, { transactionId: transaction.id });
  }

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
    logger.error("Failed to generate receipt", e, { transactionId: transaction.id });
  }

  try {
    await processNotifications({
      organizationId,
      trigger: "PAYMENT_CONFIRMED",
      relatedEntityId: leaseId,
    });
  } catch (e) {
    logger.error("Failed to send PAYMENT_CONFIRMED notification", e, { leaseId });
  }
}
