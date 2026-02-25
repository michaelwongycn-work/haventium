import { z } from "zod";
import { requireTenantAuth, handleApiError, apiSuccess, apiCreated, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
});

export async function GET(): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;

    const requests = await prisma.maintenanceRequest.findMany({
      where: { tenantId, organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        unit: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return apiSuccess(requests);
  } catch (error) {
    return handleApiError(error, "fetch maintenance requests");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;

    const body = await request.json();
    const { title, description } = createSchema.parse(body);

    // Require an active lease to determine property/unit
    const activeLease = await prisma.leaseAgreement.findFirst({
      where: { tenantId, organizationId, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        unitId: true,
        unit: { select: { propertyId: true } },
      },
    });

    if (!activeLease) {
      return apiError(
        "You must have an active lease to submit a maintenance request",
        400,
      );
    }

    const mr = await prisma.maintenanceRequest.create({
      data: {
        organizationId,
        propertyId: activeLease.unit.propertyId,
        unitId: activeLease.unitId,
        tenantId,
        leaseId: activeLease.id,
        title,
        description,
        priority: "MEDIUM",
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        organizationId,
        type: "TENANT_MAINTENANCE_SUBMITTED",
        description: `Tenant submitted maintenance request: ${title}`,
        tenantId,
        maintenanceRequestId: mr.id,
      },
    });

    return apiCreated(mr);
  } catch (error) {
    return handleApiError(error, "create maintenance request");
  }
}
