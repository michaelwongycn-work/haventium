import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAccess,
  apiSuccess,
  apiError,
  handleApiError,
  validateRequest,
  logActivity,
  verifyCurrentUserPassword,
} from "@/lib/api";
import { maskApiKey } from "@/lib/encryption";

const updateApiKeySchema = z.object({
  name: z.string().min(1, "API key name is required").optional(),
  isActive: z.boolean().optional(),
  currentPassword: z.string().optional(),
});

const deleteApiKeySchema = z.object({
  currentPassword: z
    .string()
    .min(1, "Current password is required for deletion"),
});

// GET /api/settings/api-keys/[id] - Get single API key
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const { id } = await params;

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        service: true,
        lastFourChars: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastUsedAt: true,
      },
    });

    if (!apiKey) {
      return apiError("API key not found", 404);
    }

    return apiSuccess({
      ...apiKey,
      maskedValue: maskApiKey(`••••••••${apiKey.lastFourChars}`),
    });
  } catch (error) {
    return handleApiError(error, "fetch API key");
  }
}

// PATCH /api/settings/api-keys/[id] - Update API key
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const { id } = await params;
    const validatedData = await validateRequest(request, updateApiKeySchema);

    // Check if API key exists and belongs to organization
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingKey) {
      return apiError("API key not found", 404);
    }

    // Require password for sensitive operations (deactivation)
    if (
      validatedData.isActive === false &&
      existingKey.isActive &&
      validatedData.currentPassword
    ) {
      const { verified } = await verifyCurrentUserPassword(
        session,
        validatedData.currentPassword,
      );
      if (!verified) {
        return apiError("Invalid password", 401);
      }
    }

    const updatedKey = await prisma.apiKey.update({
      where: { id },
      data: {
        name: validatedData.name,
        isActive: validatedData.isActive,
      },
    });

    // Log activity
    await logActivity(session, {
      type: "API_KEY_UPDATED",
      description: `Updated API key: ${updatedKey.name} (${updatedKey.service})`,
    });

    return apiSuccess({
      ...updatedKey,
      maskedValue: maskApiKey(`••••••••${updatedKey.lastFourChars}`),
    });
  } catch (error) {
    return handleApiError(error, "update API key");
  }
}

// DELETE /api/settings/api-keys/[id] - Delete API key
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const { id } = await params;
    const validatedData = await validateRequest(request, deleteApiKeySchema);

    // Verify current password
    const { verified } = await verifyCurrentUserPassword(
      session,
      validatedData.currentPassword,
    );
    if (!verified) {
      return apiError("Invalid password", 401);
    }

    // Check if API key exists and belongs to organization
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingKey) {
      return apiError("API key not found", 404);
    }

    await prisma.apiKey.delete({
      where: { id },
    });

    // Log activity
    await logActivity(session, {
      type: "API_KEY_DELETED",
      description: `Deleted API key: ${existingKey.name} (${existingKey.service})`,
    });

    return apiSuccess({ message: "API key deleted successfully" });
  } catch (error) {
    return handleApiError(error, "delete API key");
  }
}
