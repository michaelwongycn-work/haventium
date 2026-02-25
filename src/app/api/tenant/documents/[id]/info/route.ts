import { requireTenantAuth, handleApiError, apiSuccess, apiNotFound, apiForbidden } from "@/lib/api";
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

    const doc = await prisma.document.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        filename: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        tenantId: true,
        leaseId: true,
        unitId: true,
        propertyId: true,
        lease: { select: { id: true, startDate: true, endDate: true } },
        unit: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    if (!doc) return apiNotFound("Document");

    // Verify ownership: document must belong to tenant directly OR via a lease
    let allowed = doc.tenantId === tenantId;
    if (!allowed && doc.leaseId) {
      const lease = await prisma.leaseAgreement.findFirst({
        where: { id: doc.leaseId, tenantId, organizationId },
        select: { id: true },
      });
      allowed = !!lease;
    }

    if (!allowed) return apiForbidden();

    return apiSuccess(doc);
  } catch (error) {
    return handleApiError(error, "fetch document info");
  }
}
