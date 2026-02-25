import { requireTenantAuth, handleApiError, apiSuccess, apiNotFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;
    const { id } = await params;

    const lease = await prisma.leaseAgreement.findFirst({
      where: { id, tenantId, organizationId },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        rentAmount: true,
        paymentCycle: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentDate: true,
        paymentNotes: true,
        paidAt: true,
        depositAmount: true,
        depositStatus: true,
        isAutoRenew: true,
        autoRenewalNoticeDays: true,
        gracePeriodDays: true,
        unit: {
          select: {
            id: true,
            name: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!lease) return apiNotFound("Lease");
    return apiSuccess(lease);
  } catch (error) {
    return handleApiError(error, "fetch lease detail");
  }
}
