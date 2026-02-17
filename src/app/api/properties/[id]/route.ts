import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const updatePropertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
})

// GET /api/properties/[id] - Get single property
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

    const property = await prisma.property.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            units: true,
          },
        },
      },
    })

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      )
    }

    const activities = await prisma.activity.findMany({
      where: {
        organizationId: session.user.organizationId,
        propertyId: id,
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ ...property, activities })
  } catch (error) {
    console.error("Error fetching property:", error)
    return NextResponse.json(
      { error: "Failed to fetch property" },
      { status: 500 }
    )
  }
}

// PATCH /api/properties/[id] - Update property
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
    const validatedData = updatePropertySchema.parse(body)

    // Verify property belongs to organization
    const existingProperty = await prisma.property.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingProperty) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      )
    }

    const property = await prisma.property.update({
      where: {
        id,
      },
      data: {
        name: validatedData.name,
      },
      include: {
        _count: {
          select: {
            units: true,
          },
        },
      },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: "PROPERTY_UPDATED",
        description: `Updated property: ${property.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        propertyId: property.id,
      },
    })

    return NextResponse.json(property)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Error updating property:", error)
    return NextResponse.json(
      { error: "Failed to update property" },
      { status: 500 }
    )
  }
}

// DELETE /api/properties/[id] - Delete property
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

    // Verify property belongs to organization
    const existingProperty = await prisma.property.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingProperty) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      )
    }

    await prisma.property.delete({
      where: {
        id,
      },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: "PROPERTY_UPDATED",
        description: `Deleted property: ${existingProperty.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting property:", error)
    return NextResponse.json(
      { error: "Failed to delete property" },
      { status: 500 }
    )
  }
}
