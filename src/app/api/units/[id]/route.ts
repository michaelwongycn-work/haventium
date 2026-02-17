import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateUnitSchema = z.object({
  name: z.string().min(1, "Unit name is required"),
  dailyRate: z
    .number()
    .min(0, "Daily rate must be positive")
    .optional()
    .nullable(),
  monthlyRate: z
    .number()
    .min(0, "Monthly rate must be positive")
    .optional()
    .nullable(),
  annualRate: z
    .number()
    .min(0, "Annual rate must be positive")
    .optional()
    .nullable(),
  isUnavailable: z.boolean().optional(),
});

// GET /api/units/[id] - Get single unit with leases and activities
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "properties",
      "read",
    );
    if (!authorized) return response;

    const { id } = await params;

    const unit = await prisma.unit.findFirst({
      where: {
        id,
        property: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        property: true,
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Fetch all leases for this unit (sorted by start date, newest first)
    const leases = await prisma.leaseAgreement.findMany({
      where: {
        unitId: id,
        organizationId: session.user.organizationId,
      },
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
        renewedFrom: true,
        renewedTo: true,
      },
      orderBy: {
        startDate: "desc",
      },
    });

    // Fetch unit-specific activities
    const activities = await prisma.activity.findMany({
      where: {
        unitId: id,
        organizationId: session.user.organizationId,
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
      take: 50, // Limit to most recent 50 activities
    });

    return NextResponse.json({
      unit,
      leases,
      activities,
    });
  } catch (error) {
    return handleApiError(error, "fetch unit");
  }
}

// PATCH /api/units/[id] - Update unit
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "properties",
      "update",
    );
    if (!authorized) return response;

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateUnitSchema.parse(body);

    // At least one rate must be provided
    if (
      !validatedData.dailyRate &&
      !validatedData.monthlyRate &&
      !validatedData.annualRate
    ) {
      return NextResponse.json(
        {
          error:
            "At least one rate (daily, monthly, or annual) must be provided",
        },
        { status: 400 },
      );
    }

    // Verify unit belongs to organization
    const existingUnit = await prisma.unit.findFirst({
      where: {
        id,
        property: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        property: true,
      },
    });

    if (!existingUnit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const unit = await prisma.unit.update({
      where: {
        id,
      },
      data: {
        name: validatedData.name,
        dailyRate: validatedData.dailyRate,
        monthlyRate: validatedData.monthlyRate,
        annualRate: validatedData.annualRate,
        isUnavailable: validatedData.isUnavailable,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "UNIT_UPDATED",
        description: `Updated unit: ${unit.name} in ${existingUnit.property.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        propertyId: existingUnit.property.id,
        unitId: id,
      },
    });

    return NextResponse.json(unit);
  } catch (error) {
    return handleApiError(error, "update unit");
  }
}

// DELETE /api/units/[id] - Delete unit
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "properties",
      "delete",
    );
    if (!authorized) return response;

    const { id } = await params;

    // Verify unit belongs to organization
    const existingUnit = await prisma.unit.findFirst({
      where: {
        id,
        property: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        property: true,
      },
    });

    if (!existingUnit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Log activity before deletion so unitId FK is valid
    await prisma.activity.create({
      data: {
        type: "UNIT_UPDATED",
        description: `Deleted unit: ${existingUnit.name} from ${existingUnit.property.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        propertyId: existingUnit.property.id,
        unitId: id,
      },
    });

    await prisma.unit.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "delete unit");
  }
}
