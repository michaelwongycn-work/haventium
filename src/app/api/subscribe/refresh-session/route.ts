import { requireAuth, apiSuccess, apiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { unstable_update } from "@/lib/auth";

// POST /api/subscribe/refresh-session
// Re-fetches subscription status from DB and updates the JWT session.
// Called after returning from a Xendit payment redirect.
export async function POST() {
  try {
    const { authorized, response, session } = await requireAuth();
    if (!authorized) return response;

    const organizationId = session.user.organizationId;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { tier: true },
    });

    if (!subscription) {
      return apiError("Subscription not found", 404);
    }

    const safeSubscription = {
      id: subscription.id,
      organizationId: subscription.organizationId,
      tierId: subscription.tierId,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      startDate: subscription.startDate.toISOString(),
      endDate: subscription.endDate?.toISOString() || null,
      trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
      cancelledAt: subscription.cancelledAt?.toISOString() || null,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      externalId: subscription.externalId,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
      tier: subscription.tier
        ? {
            id: subscription.tier.id,
            type: subscription.tier.type,
            name: subscription.tier.name,
            monthlyPrice: subscription.tier.monthlyPrice.toNumber(),
            annualPrice: subscription.tier.annualPrice.toNumber(),
            maxUsers: subscription.tier.maxUsers,
            maxProperties: subscription.tier.maxProperties,
            maxUnits: subscription.tier.maxUnits,
            maxTenants: subscription.tier.maxTenants,
          }
        : null,
    };

    await unstable_update({ user: { subscription: safeSubscription } });

    return apiSuccess({ status: subscription.status });
  } catch (error) {
    return handleApiError(error, "refresh session");
  }
}
