import { z } from "zod";
import { requireTenantAuth, handleApiError, apiSuccess, apiNotFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  description: z.string().min(1).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;
    const { id } = await params;

    const mr = await prisma.maintenanceRequest.findFirst({
      where: { id, tenantId, organizationId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        unit: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    if (!mr) return apiNotFound("Maintenance request");
    return apiSuccess(mr);
  } catch (error) {
    return handleApiError(error, "fetch maintenance request");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.maintenanceRequest.findFirst({
      where: { id, tenantId, organizationId },
      select: { id: true },
    });
    if (!existing) return apiNotFound("Maintenance request");

    const body = await request.json();
    const { description } = patchSchema.parse(body);

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: { ...(description !== undefined && { description }) },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        updatedAt: true,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "update maintenance request");
  }
}
