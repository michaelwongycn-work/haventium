import { requireTenantAuth, handleApiError, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;

    const [tenant, org] = await Promise.all([
      prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        preferEmail: true,
        preferWhatsapp: true,
        preferTelegram: true,
        leaseAgreements: {
          where: { status: "ACTIVE", organizationId },
          orderBy: { startDate: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            rentAmount: true,
            paymentCycle: true,
            paymentStatus: true,
            unit: {
              select: {
                id: true,
                name: true,
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { currency: true, dateFormat: true },
      }),
    ]);

    if (!tenant) {
      return new Response("Not found", { status: 404 });
    }

    return apiSuccess({ ...tenant, orgPreferences: org });
  } catch (error) {
    return handleApiError(error, "fetch tenant profile");
  }
}
