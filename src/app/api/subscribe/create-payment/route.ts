import { requireAuth, apiSuccess, apiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createXenditPaymentLink } from "@/lib/payment-gateways/xendit";
import { NextRequest } from "next/server";

// POST /api/subscribe/create-payment
// Body (optional): { tierId?: string, billingCycle?: "MONTHLY" | "ANNUAL" }
// - If tierId is omitted or matches current tier and billingCycle is same: renewal payment
// - If tierId differs or billingCycle differs (and subscription ACTIVE): prorated charge
// - If charge === 0 (e.g. downgrade, or credit >= new price): instant switch, no Xendit
export async function POST(request: NextRequest) {
  try {
    const { authorized, response, session } = await requireAuth();
    if (!authorized) return response;

    const organizationId = session.user.organizationId;

    const body = await request.json().catch(() => ({}));
    const { tierId: requestedTierId, billingCycle: requestedBillingCycle } =
      body as { tierId?: string; billingCycle?: string };

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { tier: true },
    });

    const renewableStatuses = ["PENDING_PAYMENT", "ACTIVE", "EXPIRED"] as const;
    if (
      !subscription ||
      !renewableStatuses.includes(
        subscription.status as (typeof renewableStatuses)[number],
      )
    ) {
      return apiError("No renewable subscription found", 400);
    }

    // Resolve the target tier and billing cycle
    const targetTierId = requestedTierId ?? subscription.tierId;
    const newBillingCycle =
      (requestedBillingCycle as "MONTHLY" | "ANNUAL") ??
      subscription.billingCycle;
    const isTierChange = targetTierId !== subscription.tierId;
    const isBillingCycleChange = newBillingCycle !== subscription.billingCycle;

    // Fetch target tier if different from current
    const targetTier = isTierChange
      ? await prisma.subscriptionTier.findUnique({
          where: { id: targetTierId },
        })
      : subscription.tier;

    if (!targetTier) {
      return apiError("Target tier not found", 404);
    }

    const newFullPrice =
      newBillingCycle === "ANNUAL"
        ? Number(targetTier.annualPrice)
        : Number(targetTier.monthlyPrice);

    // Calculate proration for ACTIVE subscriptions on tier/billing changes
    const isChange = isTierChange || isBillingCycleChange;
    const canProrate =
      subscription.status === "ACTIVE" &&
      isChange &&
      subscription.endDate > new Date();

    let charge = newFullPrice;
    let credit = 0;

    if (canProrate) {
      const now = new Date();
      const totalMs = subscription.endDate.getTime() - subscription.startDate.getTime();
      const remainingMs = subscription.endDate.getTime() - now.getTime();
      const remainingRatio = Math.max(0, remainingMs / totalMs);

      const currentPrice =
        subscription.billingCycle === "ANNUAL"
          ? Number(subscription.tier.annualPrice)
          : Number(subscription.tier.monthlyPrice);

      credit = currentPrice * remainingRatio;
      charge = Math.max(0, Math.ceil(newFullPrice - credit));
    }

    // FREE tier or charge = 0: instant switch, no payment needed
    if (charge === 0) {
      const now = new Date();
      const newEndDate = new Date(now);
      if (newBillingCycle === "ANNUAL") {
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      } else {
        newEndDate.setMonth(newEndDate.getMonth() + 1);
      }

      // For FREE tier (price=0), set far-future endDate
      const endDate = newFullPrice === 0 ? new Date("2099-12-31") : newEndDate;
      const startDate = newFullPrice === 0 ? now : now;

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          tierId: targetTierId,
          billingCycle: newBillingCycle,
          status: "ACTIVE",
          startDate,
          endDate,
        },
      });
      return apiSuccess({ switched: true, tierId: targetTierId });
    }

    // For PENDING_PAYMENT (same tier/cycle renewal), reuse an existing pending link
    if (subscription.status === "PENDING_PAYMENT" && !isChange) {
      const existing = await prisma.paymentTransaction.findFirst({
        where: {
          subscriptionId: subscription.id,
          type: "SUBSCRIPTION",
          status: "PENDING",
          newTierId: null,
        },
      });
      if (existing?.paymentLinkUrl) {
        return apiSuccess({ paymentLinkUrl: existing.paymentLinkUrl });
      }
    }

    const haventiumXenditKey = process.env.HAVENTIUM_XENDIT_SECRET_KEY;
    if (!haventiumXenditKey) {
      return apiError("Payment gateway not configured", 500);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    const externalId = `sub-${subscription.id}-${Date.now()}`;
    const appUrl = process.env.PUBLIC_URL ?? "http://localhost:3000";

    const tierLabel = isChange
      ? `${targetTier.name} (${newBillingCycle.toLowerCase()}) - prorated`
      : targetTier.name;

    const xenditResult = await createXenditPaymentLink({
      apiKey: haventiumXenditKey,
      externalId,
      amount: charge,
      payerEmail: user?.email ?? undefined,
      description: `Haventium ${tierLabel} subscription`,
      currency: "IDR",
      successRedirectUrl: `${appUrl}/subscribe?payment=success`,
      failureRedirectUrl: `${appUrl}/subscribe?payment=failed`,
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
        amount: charge,
        status: "PENDING",
        externalResponse: JSON.parse(JSON.stringify(xenditResult.externalResponse)),
        newTierId: isChange ? targetTierId : null,
        newBillingCycle: isChange ? newBillingCycle : null,
        proratedCredit: credit > 0 ? credit : null,
      },
    });

    return apiSuccess({ paymentLinkUrl: xenditResult.paymentLinkUrl });
  } catch (error) {
    return handleApiError(error, "create subscription payment");
  }
}
