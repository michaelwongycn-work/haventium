import { requireTenantAuth, handleApiError, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;

    // Get all lease IDs for this tenant
    const leases = await prisma.leaseAgreement.findMany({
      where: { tenantId, organizationId },
      select: { id: true },
    });
    const leaseIds = leases.map((l) => l.id);

    const documents = await prisma.document.findMany({
      where: {
        organizationId,
        OR: [
          { tenantId },
          { leaseId: { in: leaseIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        lease: { select: { id: true, startDate: true, endDate: true } },
        // storageKey and fileUrl excluded — use /api/tenant/documents/[id] to download
      },
    });

    return apiSuccess(documents);
  } catch (error) {
    return handleApiError(error, "fetch tenant documents");
  }
}
