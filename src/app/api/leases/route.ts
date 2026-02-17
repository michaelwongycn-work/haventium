import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const createLeaseSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  unitId: z.string().min(1, "Unit is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  paymentCycle: z.enum(["DAILY", "MONTHLY", "ANNUAL"]),
  isAutoRenew: z.boolean().default(false),
  gracePeriodDays: z.number().min(0, "Grace period must be positive").optional().nullable(),
  autoRenewalNoticeDays: z.number().min(1, "Notice period must be at least 1 day").optional().nullable(),
  rentAmount: z.number().min(0, "Rent amount must be positive"),
  depositAmount: z.number().min(0, "Deposit amount must be positive").optional().nullable(),
})

// GET /api/leases - List all leases for the organization
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
    const tenantId = searchParams.get("tenantId")
    const unitId = searchParams.get("unitId")
    const propertyId = searchParams.get("propertyId")
    const search = searchParams.get("search")

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    }

    if (status && ["DRAFT", "ACTIVE", "ENDED"].includes(status)) {
      where.status = status
    }

    if (tenantId) {
      where.tenantId = tenantId
    }

    if (unitId) {
      where.unitId = unitId
    }

    if (propertyId) {
      where.unit = {
        propertyId: propertyId,
      }
    }

    if (search) {
      where.OR = [
        {
          tenant: {
            fullName: { contains: search, mode: "insensitive" },
          },
        },
        {
          unit: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ]
    }

    const leases = await prisma.leaseAgreement.findMany({
      where,
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
      },
      orderBy: {
        startDate: "desc",
      },
    })

    return NextResponse.json(leases)
  } catch (error) {
    console.error("Error fetching leases:", error)
    return NextResponse.json(
      { error: "Failed to fetch leases" },
      { status: 500 }
    )
  }
}

// POST /api/leases - Create new lease agreement
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
    const validatedData = createLeaseSchema.parse(body)

    // Verify tenant belongs to organization
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: validatedData.tenantId,
        organizationId: session.user.organizationId,
      },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      )
    }

    // Verify unit belongs to organization and get property info
    const unit = await prisma.unit.findFirst({
      where: {
        id: validatedData.unitId,
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

    // Check if unit is unavailable
    if (unit.isUnavailable) {
      return NextResponse.json(
        { error: "This unit is marked as unavailable" },
        { status: 400 }
      )
    }

    // Validate dates
    const startDate = new Date(validatedData.startDate)
    const endDate = new Date(validatedData.endDate)

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      )
    }

    // Check for overlapping active leases on this unit
    // First, check if there's an auto-renewal lease that would block this
    const autoRenewalLease = await prisma.leaseAgreement.findFirst({
      where: {
        unitId: validatedData.unitId,
        status: {
          in: ["DRAFT", "ACTIVE"],
        },
        isAutoRenew: true,
        startDate: { lte: endDate }, // Auto-renewal lease starts before or during our end date
      },
    })

    if (autoRenewalLease) {
      return NextResponse.json(
        { error: "Unit has an active auto-renewal lease. The lease must be ended before booking future dates." },
        { status: 400 }
      )
    }

    // Check for regular overlapping leases (non-auto-renewal)
    const overlappingLease = await prisma.leaseAgreement.findFirst({
      where: {
        unitId: validatedData.unitId,
        status: {
          in: ["DRAFT", "ACTIVE"],
        },
        isAutoRenew: false,
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
    })

    if (overlappingLease) {
      return NextResponse.json(
        { error: "Unit already has an overlapping lease for these dates" },
        { status: 400 }
      )
    }

    // Create lease agreement
    const lease = await prisma.leaseAgreement.create({
      data: {
        tenantId: validatedData.tenantId,
        unitId: validatedData.unitId,
        organizationId: session.user.organizationId,
        startDate,
        endDate,
        paymentCycle: validatedData.paymentCycle,
        rentAmount: validatedData.rentAmount,
        gracePeriodDays: validatedData.gracePeriodDays,
        isAutoRenew: validatedData.isAutoRenew,
        autoRenewalNoticeDays: validatedData.autoRenewalNoticeDays,
        depositAmount: validatedData.depositAmount,
        status: "DRAFT",
      },
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
      },
    })

    // Update tenant status to BOOKED
    await prisma.tenant.update({
      where: { id: validatedData.tenantId },
      data: { status: "BOOKED" },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: "LEASE_CREATED",
        description: `Created lease agreement for ${tenant.fullName} at ${unit.property.name} - ${unit.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        tenantId: tenant.id,
        propertyId: unit.propertyId,
        leaseId: lease.id,
        unitId: unit.id,
      },
    })

    return NextResponse.json(lease, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Error creating lease:", error)
    return NextResponse.json(
      { error: "Failed to create lease" },
      { status: 500 }
    )
  }
}
