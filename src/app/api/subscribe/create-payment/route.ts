import { requireAuth, apiSuccess, apiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createXenditPaymentLink } from "@/lib/payment-gateways/xendit";

// POST /api/subscribe/create-payment — generate a new Xendit payment link for pending subscription
export async function POST() {
  try {
    const { authorized, response, session } = await requireAuth();
    if (!authorized) return response;

    const organizationId = session.user.organizationId;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { tier: true },
    });

    if (!subscription || subscription.status !== "PENDING_PAYMENT") {
      return apiError("No pending subscription found", 400);
    }

    // Check for existing pending transaction
    const existing = await prisma.paymentTransaction.findFirst({
      where: {
        subscriptionId: subscription.id,
        type: "SUBSCRIPTION",
        status: "PENDING",
      },
    });

    if (existing?.paymentLinkUrl) {
      return apiSuccess({ paymentLinkUrl: existing.paymentLinkUrl });
    }

    const haventiumXenditKey = process.env.HAVENTIUM_XENDIT_SECRET_KEY;
    if (!haventiumXenditKey) {
      return apiError("Payment gateway not configured", 500);
    }

    const price =
      subscription.billingCycle === "ANNUAL"
        ? Number(subscription.tier.annualPrice)
        : Number(subscription.tier.monthlyPrice);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    const externalId = `sub-${subscription.id}-${Date.now()}`;

    const xenditResult = await createXenditPaymentLink({
      apiKey: haventiumXenditKey,
      externalId,
      amount: price,
      payerEmail: user?.email ?? undefined,
      description: `Haventium ${subscription.tier.name} subscription (${subscription.billingCycle.toLowerCase()})`,
      currency: "IDR",
    });

    await prisma.paymentTransaction.create({
      data: {
        organizationId,
        subscriptionId: subscription.id,
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

    return apiSuccess({ paymentLinkUrl: xenditResult.paymentLinkUrl });
  } catch (error) {
    return handleApiError(error, "create subscription payment");
  }
}
