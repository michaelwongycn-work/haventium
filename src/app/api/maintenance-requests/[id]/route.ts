import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAccess,
  handleApiError,
  ActivityLogger,
  apiSuccess,
  apiNotFound,
  apiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateMaintenanceRequestSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").optional(),
  description: z.string().min(10, "Description must be at least 10 characters").optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  estimatedCost: z.number().min(0, "Estimated cost must be positive").optional().nullable(),
  actualCost: z.number().min(0, "Actual cost must be positive").optional().nullable(),
});

const MAINTENANCE_REQUEST_WITH_RELATIONS = {
  include: {
    property: true,
    unit: true,
    tenant: true,
    lease: {
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
      },
    },
  },
};

// GET /api/maintenance-requests/[id] - Get single maintenance request
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let organizationId: string | undefined;
  try {
    const { authorized, response, session } = await requireAccess(
      "maintenance",
      "read",
    );
    if (!authorized) return response;

    organizationId = session.user.organizationId;
    const { id } = await params;

    const maintenanceRequest = await prisma.maintenanceRequest.findFirst({
      where: {
        id,
        organizationId,
      },
      ...MAINTENANCE_REQUEST_WITH_RELATIONS,
    });

    if (!maintenanceRequest) {
      return apiNotFound("Maintenance request not found");
    }

    const activities = await prisma.activity.findMany({
      where: {
        organizationId,
        maintenanceRequestId: id,
      },
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
    });

    const maintenanceRequestWithActivities = {
      ...maintenanceRequest,
      activities,
    };

    return apiSuccess(maintenanceRequestWithActivities);
  } catch (error) {
    return handleApiError(error, "fetch maintenance request");
  }
}

// PATCH /api/maintenance-requests/[id] - Update maintenance request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "maintenance",
      "update",
    );
    if (!authorized) return response;

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateMaintenanceRequestSchema.parse(body);

    // Verify maintenance request belongs to organization
    const existingRequest = await prisma.maintenanceRequest.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        property: true,
        unit: true,
      },
    });

    if (!existingRequest) {
      return apiNotFound("Maintenance request not found");
    }

    // Determine if status is changing to COMPLETED
    const isBeingCompleted =
      validatedData.status === "COMPLETED" &&
      existingRequest.status !== "COMPLETED";

    // Prepare update data
    const updateData: Record<string, unknown> = { ...validatedData };

    // If status is being changed to COMPLETED, set completedAt
    if (isBeingCompleted) {
      updateData.completedAt = new Date();
    }

    // Update maintenance request
    const updatedRequest = await prisma.maintenanceRequest.update({
      where: { id },
      data: updateData,
      ...MAINTENANCE_REQUEST_WITH_RELATIONS,
    });

    // Log activity
    if (isBeingCompleted) {
      await ActivityLogger.maintenanceRequestCompleted(
        session,
        {
          id: updatedRequest.id,
          title: updatedRequest.title,
          propertyId: updatedRequest.propertyId,
        },
        {
          propertyName: existingRequest.property.name,
        },
      );
    } else {
      await ActivityLogger.maintenanceRequestUpdated(
        session,
        {
          id: updatedRequest.id,
          title: updatedRequest.title,
          status: updatedRequest.status,
          propertyId: updatedRequest.propertyId,
        },
        {
          propertyName: existingRequest.property.name,
        },
      );
    }

    return apiSuccess(updatedRequest);
  } catch (error) {
    return handleApiError(error, "update maintenance request");
  }
}

// DELETE /api/maintenance-requests/[id] - Delete maintenance request
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "maintenance",
      "delete",
    );
    if (!authorized) return response;

    const { id } = await params;

    // Verify maintenance request belongs to organization
    const existingRequest = await prisma.maintenanceRequest.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        property: true,
      },
    });

    if (!existingRequest) {
      return apiNotFound("Maintenance request not found");
    }

    // Only allow deletion of OPEN or CANCELLED requests
    if (existingRequest.status === "IN_PROGRESS") {
      return apiError(
        "Cannot delete maintenance request that is in progress. Please cancel it first.",
        400,
      );
    }

    if (existingRequest.status === "COMPLETED") {
      return apiError(
        "Cannot delete completed maintenance requests. This action preserves historical records.",
        400,
      );
    }

    // Log activity before deletion
    await ActivityLogger.maintenanceRequestUpdated(
      session,
      {
        id: existingRequest.id,
        title: existingRequest.title,
        status: "DELETED",
        propertyId: existingRequest.propertyId,
      },
      {
        propertyName: existingRequest.property.name,
      },
    );

    // Delete maintenance request (activities will be set to null via onDelete: SetNull)
    await prisma.maintenanceRequest.delete({
      where: { id },
    });

    return apiSuccess({ message: "Maintenance request deleted successfully" });
  } catch (error) {
    return handleApiError(error, "delete maintenance request");
  }
}
