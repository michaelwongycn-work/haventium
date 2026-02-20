import { prisma } from "@/lib/prisma";
import { requireAccess, apiSuccess, handleApiError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "read",
    );
    if (!authorized) return response;

    const { id } = await params;
    const organizationId = session.user.organizationId;

    const transactions = await prisma.paymentTransaction.findMany({
      where: {
        leaseId: id,
        organizationId,
      },
      select: {
        id: true,
        status: true,
        paymentLinkUrl: true,
        receiptUrl: true,
        paidAt: true,
        amount: true,
        createdAt: true,
        type: true,
        gateway: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ items: transactions });
  } catch (error) {
    return handleApiError(error, "fetch lease payments");
  }
}
