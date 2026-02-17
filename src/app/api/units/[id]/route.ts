import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const updateUnitSchema = z.object({
  name: z.string().min(1, "Unit name is required"),
  dailyRate: z.number().min(0, "Daily rate must be positive").optional().nullable(),
  monthlyRate: z.number().min(0, "Monthly rate must be positive").optional().nullable(),
  annualRate: z.number().min(0, "Annual rate must be positive").optional().nullable(),
  isUnavailable: z.boolean().optional(),
})

// GET /api/units/[id] - Get single unit
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

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
    })

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Error fetching unit:", error)
    return NextResponse.json(
      { error: "Failed to fetch unit" },
      { status: 500 }
    )
  }
}

// PATCH /api/units/[id] - Update unit
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateUnitSchema.parse(body)

    // At least one rate must be provided
    if (!validatedData.dailyRate && !validatedData.monthlyRate && !validatedData.annualRate) {
      return NextResponse.json(
        { error: "At least one rate (daily, monthly, or annual) must be provided" },
        { status: 400 }
      )
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
    })

    if (!existingUnit) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      )
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
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: "UNIT_UPDATED",
        description: `Updated unit: ${unit.name} in ${existingUnit.property.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        propertyId: existingUnit.property.id,
      },
    })

    return NextResponse.json(unit)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Error updating unit:", error)
    return NextResponse.json(
      { error: "Failed to update unit" },
      { status: 500 }
    )
  }
}

// DELETE /api/units/[id] - Delete unit
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

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
    })

    if (!existingUnit) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      )
    }

    await prisma.unit.delete({
      where: {
        id,
      },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: "UNIT_UPDATED",
        description: `Deleted unit: ${existingUnit.name} from ${existingUnit.property.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        propertyId: existingUnit.property.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting unit:", error)
    return NextResponse.json(
      { error: "Failed to delete unit" },
      { status: 500 }
    )
  }
}
