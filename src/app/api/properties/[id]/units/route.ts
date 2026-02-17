import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const createUnitSchema = z.object({
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
});

// GET /api/properties/[id]/units - List all units for a property
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

    // Verify property belongs to organization
    const property = await prisma.property.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }

    const units = await prisma.unit.findMany({
      where: {
        propertyId: id,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(units);
  } catch (error) {
    return handleApiError(error, "fetch units");
  }
}

// POST /api/properties/[id]/units - Create new unit
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "properties",
      "create",
    );
    if (!authorized) return response;

    const { id } = await params;

    // Verify property belongs to organization
    const property = await prisma.property.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validatedData = createUnitSchema.parse(body);

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

    // Check subscription limits
    const subscription = session.user.subscription;
    if (subscription?.tier) {
      const currentUnitCount = await prisma.unit.count({
        where: {
          property: {
            organizationId: session.user.organizationId,
          },
        },
      });

      if (subscription.tier.maxUnits !== null && currentUnitCount >= subscription.tier.maxUnits) {
        return NextResponse.json(
          {
            error: `Unit limit reached. Your ${subscription.tier.name} plan allows ${subscription.tier.maxUnits} units.`,
          },
          { status: 403 },
        );
      }
    }

    const unit = await prisma.unit.create({
      data: {
        name: validatedData.name,
        dailyRate: validatedData.dailyRate,
        monthlyRate: validatedData.monthlyRate,
        annualRate: validatedData.annualRate,
        propertyId: id,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "UNIT_CREATED",
        description: `Created unit: ${unit.name} in ${property.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        propertyId: property.id,
        unitId: unit.id,
      },
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    return handleApiError(error, "create unit");
  }
}
