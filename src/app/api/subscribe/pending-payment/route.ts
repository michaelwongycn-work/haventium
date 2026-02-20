import { requireAuth, apiSuccess, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/subscribe/pending-payment — get existing pending payment link
export async function GET() {
  try {
    const { authorized, response, session } = await requireAuth();
    if (!authorized) return response;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: session.user.organizationId },
    });

    if (!subscription) {
      return apiSuccess({ paymentLinkUrl: null });
    }

    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        subscriptionId: subscription.id,
        type: "SUBSCRIPTION",
        status: "PENDING",
      },
      select: { paymentLinkUrl: true },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ paymentLinkUrl: transaction?.paymentLinkUrl ?? null });
  } catch (error) {
    return handleApiError(error, "fetch pending payment");
  }
}
