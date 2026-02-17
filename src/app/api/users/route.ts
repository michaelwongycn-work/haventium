import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/password";
import {
  requireAccess,
  verifyCurrentUserPassword,
  checkSubscriptionLimit,
  ActivityLogger,
  USER_SELECT,
  apiSuccess,
  apiCreated,
  apiError,
  handleApiError,
  validateRequest,
  parsePaginationParams,
  createPaginatedResponse,
} from "@/lib/api";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleId: z.string().min(1, "Role is required"),
  currentPassword: z
    .string()
    .min(1, "Your password is required to confirm this action"),
});

// GET /api/users - List all users for the organization
export async function GET(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "users",
      "manage",
    );
    if (!authorized) return response;

    const { searchParams } = new URL(request.url);
    const { skip, limit, page } = parsePaginationParams(searchParams);

    const where = {
      organizationId: session.user.organizationId,
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: {
          createdAt: "asc",
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json(createPaginatedResponse(users, page, limit, total));
  } catch (error) {
    return handleApiError(error, "fetch users");
  }
}

// POST /api/users - Invite a new user
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "users",
      "manage",
    );
    if (!authorized) return response;

    const validatedData = await validateRequest(request, createUserSchema);

    // Verify current user's password
    const passwordCheck = await verifyCurrentUserPassword(
      session,
      validatedData.currentPassword,
    );
    if (!passwordCheck.verified) return passwordCheck.error!;

    // Check subscription limits
    const limitCheck = await checkSubscriptionLimit(session, "users");
    if (!limitCheck.allowed) return limitCheck.error!;

    // Validate password strength
    const passwordValidation = validatePassword(validatedData.password);
    if (!passwordValidation.valid) {
      return apiError(passwordValidation.errors[0], 400);
    }

    // Verify role belongs to the organization
    const role = await prisma.role.findFirst({
      where: {
        id: validatedData.roleId,
        organizationId: session.user.organizationId,
      },
    });

    if (!role) {
      return apiError("Role not found", 400);
    }

    const hashedPw = await hashPassword(validatedData.password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: validatedData.name,
          email: validatedData.email,
          hashedPassword: hashedPw,
          organizationId: session.user.organizationId,
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: validatedData.roleId,
        },
      });

      return tx.user.findUnique({
        where: { id: newUser.id },
        select: USER_SELECT,
      });
    });

    // Log activity
    await ActivityLogger.userInvited(session, {
      name: validatedData.name,
      email: validatedData.email,
    });

    return apiCreated(user);
  } catch (error) {
    return handleApiError(error, "create user");
  }
}
