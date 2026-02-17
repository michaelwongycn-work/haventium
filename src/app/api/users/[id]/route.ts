import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAccess,
  verifyCurrentUserPassword,
  validateRoleChange,
  ensureNotLastOwner,
  ensureNotLastUser,
  ActivityLogger,
  USER_SELECT,
  findUserInOrganization,
  apiSuccess,
  apiNotFound,
  apiError,
  handleApiError,
  validateRequest,
} from "@/lib/api";

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email address").optional(),
  roleId: z.string().min(1, "Role is required").optional(),
  currentPassword: z
    .string()
    .min(1, "Your password is required to confirm this action"),
});

// GET /api/users/[id] - Get a single user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "users",
      "manage",
    );
    if (!authorized) return response;

    const { id } = await params;

    const user = await findUserInOrganization(id, session.user.organizationId);

    if (!user) {
      return apiNotFound("User not found");
    }

    return apiSuccess(user);
  } catch (error) {
    return handleApiError(error, "fetch user");
  }
}

// PATCH /api/users/[id] - Update a user
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "users",
      "manage",
    );
    if (!authorized) return response;

    const { id } = await params;
    const validatedData = await validateRequest(request, updateUserSchema);

    // Verify current user's password
    const passwordCheck = await verifyCurrentUserPassword(
      session,
      validatedData.currentPassword,
    );
    if (!passwordCheck.verified) return passwordCheck.error!;

    // Verify user belongs to organization
    const existingUser = await findUserInOrganization(
      id,
      session.user.organizationId,
    );

    if (!existingUser) {
      return apiNotFound("User not found");
    }

    // If changing role, validate the change
    if (validatedData.roleId) {
      const roleValidation = await validateRoleChange(
        id,
        validatedData.roleId,
        session.user.organizationId,
      );
      if (!roleValidation.valid) return roleValidation.error!;
    }

    const user = await prisma.$transaction(async (tx) => {
      // Update name/email if provided
      const updateData: Record<string, string> = {};
      if (validatedData.name !== undefined)
        updateData.name = validatedData.name;
      if (validatedData.email !== undefined)
        updateData.email = validatedData.email;

      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id },
          data: updateData,
        });
      }

      // Replace role if provided
      if (validatedData.roleId) {
        // Verify role belongs to org
        const role = await tx.role.findFirst({
          where: {
            id: validatedData.roleId,
            organizationId: session.user.organizationId,
          },
        });

        if (!role) {
          throw new Error("ROLE_NOT_FOUND");
        }

        await tx.userRole.deleteMany({
          where: { userId: id },
        });

        await tx.userRole.create({
          data: {
            userId: id,
            roleId: validatedData.roleId,
          },
        });
      }

      return tx.user.findUnique({
        where: { id },
        select: USER_SELECT,
      });
    });

    // Log activity
    await ActivityLogger.userUpdated(session, {
      name: user?.name || "Unknown",
    });

    return apiSuccess(user);
  } catch (error) {
    return handleApiError(error, "update user");
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "users",
      "manage",
    );
    if (!authorized) return response;

    const { id } = await params;

    // Can't delete yourself
    if (id === session.user.id) {
      return apiError("You cannot delete your own account", 400);
    }

    // Verify current user's password
    const body = await request.json().catch(() => ({}));
    const currentPassword = (body as any)?.currentPassword;

    const passwordCheck = await verifyCurrentUserPassword(
      session,
      currentPassword,
    );
    if (!passwordCheck.verified) return passwordCheck.error!;

    // Verify user belongs to organization
    const existingUser = await findUserInOrganization(
      id,
      session.user.organizationId,
    );

    if (!existingUser) {
      return apiNotFound("User not found");
    }

    // Validate deletion is allowed
    const notLastUserCheck = await ensureNotLastUser(
      id,
      session.user.organizationId,
    );
    if (!notLastUserCheck.valid) return notLastUserCheck.error!;

    const notLastOwnerCheck = await ensureNotLastOwner(id);
    if (!notLastOwnerCheck.valid) return notLastOwnerCheck.error!;

    await prisma.user.delete({
      where: { id },
    });

    // Log activity
    await ActivityLogger.userDeleted(session, {
      name: existingUser.name || "Unknown",
      email: existingUser.email || "",
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error, "delete user");
  }
}
