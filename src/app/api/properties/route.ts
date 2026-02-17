import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const createPropertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
})

// GET /api/properties - List all properties for the organization
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const properties = await prisma.property.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            units: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(properties)
  } catch (error) {
    console.error("Error fetching properties:", error)
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    )
  }
}

// POST /api/properties - Create new property
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = createPropertySchema.parse(body)

    // Check subscription limits
    const subscription = session.user.subscription
    if (subscription?.tier) {
      const currentPropertyCount = await prisma.property.count({
        where: {
          organizationId: session.user.organizationId,
        },
      })

      if (currentPropertyCount >= subscription.tier.maxProperties) {
        return NextResponse.json(
          { error: `Property limit reached. Your ${subscription.tier.name} plan allows ${subscription.tier.maxProperties} properties.` },
          { status: 403 }
        )
      }
    }

    const property = await prisma.property.create({
      data: {
        name: validatedData.name,
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

    // Log activity
    await prisma.activity.create({
      data: {
        type: "PROPERTY_CREATED",
        description: `Created property: ${property.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        propertyId: property.id,
      },
    })

    return NextResponse.json(property, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Error creating property:", error)
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    )
  }
}
