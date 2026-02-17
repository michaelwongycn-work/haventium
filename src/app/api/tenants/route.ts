import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const createTenantSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().optional().refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: "Invalid email address",
  }),
  phone: z.string().optional().refine((val) => !val || (/^[\d\s\-\+\(\)]+$/.test(val) && val.replace(/\D/g, "").length >= 8), {
    message: "Invalid phone number (at least 8 digits required)",
  }),
  preferEmail: z.boolean().default(false),
  preferWhatsapp: z.boolean().default(false),
}).refine((data) => data.email || data.phone, {
  message: "At least one contact method (email or phone) is required",
  path: ["email"],
})

// GET /api/tenants - List all tenants for the organization
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    }

    if (status && ["LEAD", "BOOKED", "ACTIVE", "EXPIRED"].includes(status)) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ]
    }

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            leaseAgreements: true,
          },
        },
      },
    })

    return NextResponse.json(tenants)
  } catch (error) {
    console.error("Error fetching tenants:", error)
    return NextResponse.json(
      { error: "Failed to fetch tenants" },
      { status: 500 }
    )
  }
}

// POST /api/tenants - Create new tenant
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
    const validatedData = createTenantSchema.parse(body)

    // Check subscription limits
    const subscription = session.user.subscription
    if (subscription?.tier) {
      const currentTenantCount = await prisma.tenant.count({
        where: {
          organizationId: session.user.organizationId,
        },
      })

      if (currentTenantCount >= subscription.tier.maxTenants) {
        return NextResponse.json(
          { error: `Tenant limit reached. Your ${subscription.tier.name} plan allows ${subscription.tier.maxTenants} tenants.` },
          { status: 403 }
        )
      }
    }

    // Check if email already exists in organization
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        email: validatedData.email,
        organizationId: session.user.organizationId,
      },
    })

    if (existingTenant) {
      return NextResponse.json(
        { error: "A tenant with this email already exists" },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.create({
      data: {
        fullName: validatedData.fullName,
        email: validatedData.email || "",
        phone: validatedData.phone || "",
        status: "LEAD", // All new tenants start as LEAD
        preferEmail: validatedData.preferEmail,
        preferWhatsapp: validatedData.preferWhatsapp,
        organizationId: session.user.organizationId,
      },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: "TENANT_CREATED",
        description: `Created tenant: ${tenant.fullName} (${tenant.email})`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        tenantId: tenant.id,
      },
    })

    return NextResponse.json(tenant, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Error creating tenant:", error)
    return NextResponse.json(
      { error: "Failed to create tenant" },
      { status: 500 }
    )
  }
}
