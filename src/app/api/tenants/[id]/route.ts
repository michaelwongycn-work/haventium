import { z } from "zod";
import { requireAccess, handleApiError, apiSuccess, apiNotFound, apiError, logActivity } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateTenantSchema = z.object({
  fullName: z.string().min(1, "Full name is required").optional(),
  email: z
    .string()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Invalid email address",
    }),
  phone: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val ||
        (/^[\d\s\-\+\(\)]+$/.test(val) && val.replace(/\D/g, "").length >= 8),
      {
        message: "Invalid phone number (at least 8 digits required)",
      },
    ),
  preferEmail: z.boolean().optional(),
  preferWhatsapp: z.boolean().optional(),
});

// GET /api/tenants/[id] - Get single tenant
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "tenants",
      "read",
    );
    if (!authorized) return response;

    const { id } = await params;

    const tenant = await prisma.tenant.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        leaseAgreements: {
          include: {
            unit: {
              include: {
                property: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        maintenanceRequests: {
          include: {
            property: true,
            unit: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        activities: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
      },
    });

    if (!tenant) {
      return apiNotFound("Tenant not found");
    }

    return apiSuccess(tenant);
  } catch (error) {
    return handleApiError(error, "fetch tenant");
  }
}

// PATCH /api/tenants/[id] - Update tenant
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "tenants",
      "update",
    );
    if (!authorized) return response;

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateTenantSchema.parse(body);

    // Verify tenant belongs to organization
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingTenant) {
      return apiNotFound("Tenant not found");
    }

    // If email is being changed, check for duplicates
    if (validatedData.email && validatedData.email !== existingTenant.email) {
      const duplicateTenant = await prisma.tenant.findFirst({
        where: {
          email: validatedData.email,
          organizationId: session.user.organizationId,
          id: { not: id },
        },
      });

      if (duplicateTenant) {
        return apiError("A tenant with this email already exists", 400);
      }
    }

    const updateData: Record<string, string | boolean> = {};
    if (validatedData.fullName !== undefined)
      updateData.fullName = validatedData.fullName;
    if (validatedData.email !== undefined)
      updateData.email = validatedData.email;
    if (validatedData.phone !== undefined)
      updateData.phone = validatedData.phone;
    if (validatedData.preferEmail !== undefined)
      updateData.preferEmail = validatedData.preferEmail;
    if (validatedData.preferWhatsapp !== undefined)
      updateData.preferWhatsapp = validatedData.preferWhatsapp;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    // Log activity
    await logActivity(session, {
      type: "TENANT_UPDATED",
      description: `Updated tenant: ${tenant.fullName}`,
      tenantId: tenant.id,
    });

    return apiSuccess(tenant);
  } catch (error) {
    return handleApiError(error, "update tenant");
  }
}

// DELETE /api/tenants/[id] - Delete tenant
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "tenants",
      "delete",
    );
    if (!authorized) return response;

    const { id } = await params;

    // Verify tenant belongs to organization
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            leaseAgreements: true,
          },
        },
      },
    });

    if (!existingTenant) {
      return apiNotFound("Tenant not found");
    }

    // Check if tenant has active leases
    const activeLeases = await prisma.leaseAgreement.count({
      where: {
        tenantId: id,
        organizationId: session.user.organizationId,
        status: "ACTIVE",
      },
    });

    if (activeLeases > 0) {
      return apiError("Cannot delete tenant with active lease agreements. Please end the leases first.", 400);
    }

    await prisma.tenant.delete({
      where: { id },
    });

    // Log activity
    await logActivity(session, {
      type: "TENANT_UPDATED",
      description: `Deleted tenant: ${existingTenant.fullName} (${existingTenant.email})`,
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error, "delete tenant");
  }
}
