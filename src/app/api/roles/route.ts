import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  accessIds: z.array(z.string()).min(1, "At least one permission is required"),
});

// GET /api/roles - List all roles for the organization
export async function GET() {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const roles = await prisma.role.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        roleAccesses: {
          include: {
            access: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(roles);
  } catch (error) {
    return handleApiError(error, "fetch roles");
  }
}

// POST /api/roles - Create a new role
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const body = await request.json();
    const validatedData = createRoleSchema.parse(body);

    // Block creating a role named "Owner" (reserved)
    if (validatedData.name.toLowerCase() === "owner") {
      return NextResponse.json(
        { error: 'The role name "Owner" is reserved' },
        { status: 400 },
      );
    }

    const role = await prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          name: validatedData.name,
          organizationId: session.user.organizationId,
        },
      });

      await tx.roleAccess.createMany({
        data: validatedData.accessIds.map((accessId) => ({
          roleId: newRole.id,
          accessId,
        })),
      });

      return tx.role.findUnique({
        where: { id: newRole.id },
        include: {
          roleAccesses: {
            include: {
              access: true,
            },
          },
          _count: {
            select: {
              userRoles: true,
            },
          },
        },
      });
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "OTHER",
        description: `Created role: ${validatedData.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return handleApiError(error, "create role");
  }
}
