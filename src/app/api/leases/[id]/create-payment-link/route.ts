import { prisma } from "@/lib/prisma";
import {
  requireAccess,
  apiSuccess,
  apiCreated,
  apiError,
  handleApiError,
  logActivity,
} from "@/lib/api";
import { decrypt } from "@/lib/encryption";
import { createXenditPaymentLink } from "@/lib/payment-gateways/xendit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "update",
    );
    if (!authorized) return response;

    const { id } = await params;
    const organizationId = session.user.organizationId;

    // Fetch the lease
    const lease = await prisma.leaseAgreement.findFirst({
      where: { id, organizationId },
      include: {
        tenant: { select: { email: true, fullName: true, phone: true } },
        unit: {
          include: {
            property: { select: { name: true } },
          },
        },
      },
    });

    if (!lease) {
      return apiError("Lease not found", 404);
    }

    // Guard: must be DRAFT and unpaid
    if (lease.status !== "DRAFT") {
      return apiError(
        "Payment links can only be created for DRAFT leases",
        400,
      );
    }

    if (lease.paidAt) {
      return apiError("This lease has already been paid", 400);
    }

    // Idempotency: return existing PENDING transaction if one exists
    const existingTransaction = await prisma.paymentTransaction.findFirst({
      where: {
        leaseId: id,
        organizationId,
        status: "PENDING",
      },
    });

    if (existingTransaction) {
      return apiSuccess({
        paymentLinkUrl: existingTransaction.paymentLinkUrl,
        transactionId: existingTransaction.id,
      });
    }

    // Fetch org Xendit key
    const xenditKey = await prisma.apiKey.findUnique({
      where: {
        organizationId_service: {
          organizationId,
          service: "XENDIT",
        },
      },
    });

    if (!xenditKey || !xenditKey.isActive) {
      return apiError(
        "Xendit API key not configured. Please add your Xendit key in Organization Settings.",
        400,
      );
    }

    const apiKeyValue = decrypt(
      xenditKey.encryptedValue,
      xenditKey.encryptionIv,
      xenditKey.encryptionTag,
    );

    const externalId = `rent-${id}-${Date.now()}`;
    const amount = Number(lease.rentAmount);

    // Fetch org currency
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true, name: true },
    });

    const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
    const result = await createXenditPaymentLink({
      apiKey: apiKeyValue,
      externalId,
      amount,
      payerEmail: lease.tenant.email ?? undefined,
      description: `Rent payment for ${lease.unit.property.name} / ${lease.unit.name}`,
      currency: org?.currency ?? "IDR",
      successRedirectUrl: `${baseUrl}/leases/${id}?payment=success`,
      failureRedirectUrl: `${baseUrl}/leases/${id}?payment=failed`,
    });

    // Create PaymentTransaction
    const transaction = await prisma.paymentTransaction.create({
      data: {
        organizationId,
        leaseId: id,
        type: "RENT",
        gateway: "XENDIT",
        externalId: result.externalId,
        xenditInvoiceId: result.xenditInvoiceId,
        paymentLinkUrl: result.paymentLinkUrl,
        amount: lease.rentAmount,
        status: "PENDING",
        externalResponse: JSON.parse(JSON.stringify(result.externalResponse)),
      },
    });

    // Log activity
    await logActivity(session, {
      type: "PAYMENT_LINK_CREATED",
      description: `Created payment link for lease (${lease.unit.property.name} / ${lease.unit.name}) — ${lease.tenant.fullName}`,
      leaseId: id,
      tenantId: lease.tenantId,
    });

    return apiCreated({
      paymentLinkUrl: transaction.paymentLinkUrl,
      transactionId: transaction.id,
    });
  } catch (error) {
    return handleApiError(error, "create payment link");
  }
}
