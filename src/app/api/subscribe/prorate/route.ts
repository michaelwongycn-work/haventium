import { requireAuth, apiSuccess, apiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// GET /api/subscribe/prorate?tierId=X&billingCycle=MONTHLY|ANNUAL
// Returns proration preview: credit, newFullPrice, charge, daysRemaining, totalDays
export async function GET(request: NextRequest) {
  try {
    const { authorized, response, session } = await requireAuth();
    if (!authorized) return response;

    const organizationId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const tierId = searchParams.get("tierId");
    const billingCycle = searchParams.get("billingCycle") as "MONTHLY" | "ANNUAL" | null;

    if (!tierId || !billingCycle) {
      return apiError("tierId and billingCycle are required", 400);
    }
    if (billingCycle !== "MONTHLY" && billingCycle !== "ANNUAL") {
      return apiError("billingCycle must be MONTHLY or ANNUAL", 400);
    }

    const [subscription, targetTier] = await Promise.all([
      prisma.subscription.findUnique({
        where: { organizationId },
        include: { tier: true },
      }),
      prisma.subscriptionTier.findUnique({ where: { id: tierId } }),
    ]);

    if (!subscription) return apiError("Subscription not found", 404);
    if (!targetTier) return apiError("Target tier not found", 404);

    const newFullPrice =
      billingCycle === "ANNUAL"
        ? Number(targetTier.annualPrice)
        : Number(targetTier.monthlyPrice);

    const now = new Date();
    const canProrate =
      subscription.status === "ACTIVE" && subscription.endDate > now;

    let credit = 0;
    let daysRemaining = 0;
    let totalDays = 0;

    if (canProrate) {
      const MS_PER_DAY = 1000 * 60 * 60 * 24;
      totalDays = Math.round(
        (subscription.endDate.getTime() - subscription.startDate.getTime()) / MS_PER_DAY,
      );
      daysRemaining = Math.max(
        0,
        Math.ceil((subscription.endDate.getTime() - now.getTime()) / MS_PER_DAY),
      );
      const remainingRatio = totalDays > 0 ? daysRemaining / totalDays : 0;

      const currentPrice =
        subscription.billingCycle === "ANNUAL"
          ? Number(subscription.tier.annualPrice)
          : Number(subscription.tier.monthlyPrice);

      credit = currentPrice * remainingRatio;
    }

    const charge = Math.max(0, Math.ceil(newFullPrice - credit));

    // New period end date
    const newPeriodStart = now;
    const newPeriodEnd = new Date(now);
    if (billingCycle === "ANNUAL") {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    } else {
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    }

    return apiSuccess({
      credit: Math.floor(credit), // display as integer
      newFullPrice,
      charge,
      daysRemaining,
      totalDays,
      newPeriodStart: newPeriodStart.toISOString(),
      newPeriodEnd: newPeriodEnd.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "prorate calculation");
  }
}
