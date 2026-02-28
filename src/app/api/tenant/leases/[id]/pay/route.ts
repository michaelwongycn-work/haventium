import { z } from "zod";
import { requireTenantAuth, handleApiError, apiSuccess, apiError, apiNotFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { createXenditPaymentLink } from "@/lib/payment-gateways/xendit";
import { logger } from "@/lib/logger";
import crypto from "crypto";

/**
 * Validates that a redirect URL is on the same origin as the app.
 * Returns the URL if valid, undefined otherwise.
 */
function validateRedirectUrl(url: string | undefined, requestUrl: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const origin = new URL(requestUrl).origin;
    if (parsed.origin !== origin) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

const schema = z.object({
  successRedirectUrl: z.string().url().optional(),
  failureRedirectUrl: z.string().url().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestUrl = request.url;
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId, email } = auth.tenant;
    const { id } = await params;

    // Verify lease ownership and fetch details
    const lease = await prisma.leaseAgreement.findFirst({
      where: { id, tenantId, organizationId },
      select: {
        id: true,
        status: true,
        rentAmount: true,
        unit: {
          select: {
            name: true,
            property: { select: { name: true } },
          },
        },
        tenant: { select: { fullName: true } },
      },
    });

    if (!lease) return apiNotFound("Lease");
    if (lease.status !== "DRAFT" && lease.status !== "ACTIVE") {
      return apiError("Payment not applicable for this lease status", 400);
    }

    // Get org's Xendit API key
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: {
        organizationId_service: { organizationId, service: "XENDIT" },
      },
    });
    if (!apiKeyRecord?.isActive) {
      return apiError("Online payment not configured", 503);
    }

    const xenditApiKey = decrypt(
      apiKeyRecord.encryptedValue,
      apiKeyRecord.encryptionIv,
      apiKeyRecord.encryptionTag,
    );

    // Parse optional redirect URLs and validate they're same-origin
    const body = await request.json().catch(() => ({}));
    const parsed = schema.parse(body);
    const successRedirectUrl = validateRedirectUrl(parsed.successRedirectUrl, requestUrl);
    const failureRedirectUrl = validateRedirectUrl(parsed.failureRedirectUrl, requestUrl);

    const externalId = `tenant-portal-${id}-${crypto.randomBytes(6).toString("hex")}`;
    const description = `Rent — ${lease.unit.property.name} ${lease.unit.name} — ${lease.tenant.fullName}`;
    const amount = Number(lease.rentAmount);

    const result = await createXenditPaymentLink({
      apiKey: xenditApiKey,
      externalId,
      amount,
      payerEmail: email,
      description,
      successRedirectUrl,
      failureRedirectUrl,
    });

    // Record payment transaction
    await prisma.paymentTransaction.create({
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
    await prisma.activity.create({
      data: {
        organizationId,
        type: "TENANT_PAYMENT_LINK_CREATED",
        description: `Tenant ${lease.tenant.fullName} created a payment link for lease ${id}`,
        tenantId,
        leaseId: id,
      },
    });

    logger.info("Tenant payment link created", {
      organizationId,
      tenantId,
      leaseId: id,
      externalId: result.externalId,
    });

    return apiSuccess({
      paymentLinkUrl: result.paymentLinkUrl,
      externalId: result.externalId,
    });
  } catch (error) {
    return handleApiError(error, "create payment link");
  }
}
