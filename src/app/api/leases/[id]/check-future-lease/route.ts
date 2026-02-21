import { requireAccess, handleApiError, apiSuccess, apiNotFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "read",
    );
    if (!authorized) return response;

    const { id } = await params;

    const lease = await prisma.leaseAgreement.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!lease) {
      return apiNotFound("Lease not found");
    }

    const futureLease = await prisma.leaseAgreement.findFirst({
      where: {
        unitId: lease.unitId,
        organizationId: session.user.organizationId,
        id: { not: id },
        status: { in: ["DRAFT", "ACTIVE"] },
        startDate: { gt: lease.endDate },
      },
    });

    return apiSuccess({ hasFutureLease: !!futureLease });
  } catch (error) {
    return handleApiError(error, "check future leases");
  }
}
