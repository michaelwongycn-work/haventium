import { requireTenantAuth, handleApiError, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;

    const leases = await prisma.leaseAgreement.findMany({
      where: { tenantId, organizationId },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        rentAmount: true,
        paymentCycle: true,
        paymentStatus: true,
        paymentMethod: true,
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

    return apiSuccess(leases);
  } catch (error) {
    return handleApiError(error, "fetch tenant leases");
  }
}
