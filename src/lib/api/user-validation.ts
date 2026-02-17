import { prisma } from "@/lib/prisma";
import { apiError } from "./response";

/**
 * User Role Validation Utilities
 * Business logic for user role management
 */

export interface RoleValidationResult {
  valid: boolean;
  error?: ReturnType<typeof apiError>;
}

/**
 * Ensure a user is not the last one with the Owner role
 */
export async function ensureNotLastOwner(
  userId: string,
): Promise<RoleValidationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return {
      valid: false,
      error: apiError("User not found", 404),
    };
  }

  // Check if user has any system (Owner) roles
  const systemRole = user.userRoles.find((ur) => ur.role.isSystem);

  if (systemRole) {
    // Count how many users have this role
    const roleCount = await prisma.userRole.count({
      where: {
        roleId: systemRole.roleId,
      },
    });

    if (roleCount <= 1) {
      return {
        valid: false,
        error: apiError("Cannot modify the last user with the Owner role", 400),
      };
    }
  }

  return { valid: true };
}

/**
 * Ensure organization has at least one user
 */
export async function ensureNotLastUser(
  userId: string,
  organizationId: string,
): Promise<RoleValidationResult> {
  const totalUsers = await prisma.user.count({
    where: { organizationId },
  });

  if (totalUsers <= 1) {
    return {
      valid: false,
      error: apiError("Cannot delete the last user in the organization", 400),
    };
  }

  return { valid: true };
}

/**
 * Validate role change for a user
 */
export async function validateRoleChange(
  userId: string,
  newRoleId: string,
  organizationId: string,
): Promise<RoleValidationResult> {
  // Verify role belongs to organization
  const role = await prisma.role.findFirst({
    where: {
      id: newRoleId,
      organizationId,
    },
  });

  if (!role) {
    return {
      valid: false,
      error: apiError("Role not found", 400),
    };
  }

  // Check if changing from Owner role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return {
      valid: false,
      error: apiError("User not found", 404),
    };
  }

  const currentOwnerRole = user.userRoles.find((ur) => ur.role.isSystem);

  if (currentOwnerRole && newRoleId !== currentOwnerRole.roleId) {
    // Changing from Owner role - ensure not the last owner
    const ownerCount = await prisma.userRole.count({
      where: {
        roleId: currentOwnerRole.roleId,
      },
    });

    if (ownerCount <= 1) {
      return {
        valid: false,
        error: apiError(
          "Cannot reassign the last user with the Owner role",
          400,
        ),
      };
    }
  }

  return { valid: true };
}
