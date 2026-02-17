import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const updateRoleSchema = z.object({
  name: z.string().min(1, "Role name is required").optional(),
  accessIds: z
    .array(z.string())
    .min(1, "At least one permission is required")
    .optional(),
});

// GET /api/roles/[id] - Get a single role
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await checkAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const { id } = await params;

    const role = await prisma.role.findFirst({
      where: {
        id,
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
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json(role);
  } catch (error) {
    console.error("Error fetching role:", error);
    return NextResponse.json(
      { error: "Failed to fetch role" },
      { status: 500 },
    );
  }
}

// PATCH /api/roles/[id] - Update a role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await checkAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateRoleSchema.parse(body);

    // Verify role belongs to organization
    const existingRole = await prisma.role.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Block editing system roles
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: "Cannot modify the Owner role" },
        { status: 400 },
      );
    }

    // Block renaming to "Owner" (reserved)
    if (validatedData.name && validatedData.name.toLowerCase() === "owner") {
      return NextResponse.json(
        { error: 'The role name "Owner" is reserved' },
        { status: 400 },
      );
    }

    const role = await prisma.$transaction(async (tx) => {
      // Update role name if provided
      if (validatedData.name) {
        await tx.role.update({
          where: { id },
          data: { name: validatedData.name },
        });
      }

      // Replace accesses if provided
      if (validatedData.accessIds) {
        await tx.roleAccess.deleteMany({
          where: { roleId: id },
        });

        await tx.roleAccess.createMany({
          data: validatedData.accessIds.map((accessId) => ({
            roleId: id,
            accessId,
          })),
        });
      }

      return tx.role.findUnique({
        where: { id },
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
        description: `Updated role: ${role?.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(role);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A role with this name already exists" },
        { status: 400 },
      );
    }

    console.error("Error updating role:", error);
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 },
    );
  }
}

// DELETE /api/roles/[id] - Delete a role
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await checkAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const { id } = await params;

    // Verify role belongs to organization
    const existingRole = await prisma.role.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Block deletion of system roles
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: "Cannot delete the Owner role" },
        { status: 400 },
      );
    }

    // Block deletion if role has assigned users
    if (existingRole._count.userRoles > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role "${existingRole.name}" because it has ${existingRole._count.userRoles} user(s) assigned. Reassign them first.`,
        },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.roleAccess.deleteMany({
        where: { roleId: id },
      });
      await tx.role.delete({
        where: { id },
      });
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "OTHER",
        description: `Deleted role: ${existingRole.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 },
    );
  }
}
