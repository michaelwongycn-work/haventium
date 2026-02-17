import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const updateLeaseSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentCycle: z.enum(["DAILY", "MONTHLY", "ANNUAL"]).optional(),
  rentAmount: z.number().min(0, "Rent amount must be positive").optional(),
  isAutoRenew: z.boolean().optional(),
  gracePeriodDays: z.number().min(0, "Grace period must be positive").optional().nullable(),
  autoRenewalNoticeDays: z.number().min(1, "Notice period must be at least 1 day").optional().nullable(),
  depositAmount: z.number().min(0, "Deposit amount must be positive").optional().nullable(),
  depositStatus: z.enum(["HELD", "RETURNED", "FORFEITED"]).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ENDED"]).optional(),
  paidAt: z.string().nullable().optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "VIRTUAL_ACCOUNT", "QRIS", "MANUAL"]).optional(),
})

// GET /api/leases/[id] - Get single lease
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

    const lease = await prisma.leaseAgreement.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
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

    if (!lease) {
      return NextResponse.json(
        { error: "Lease not found" },
        { status: 404 }
      )
    }

    // Fetch activities related to this lease (tenant and property)
    const activities = await prisma.activity.findMany({
      where: {
        organizationId: session.user.organizationId,
        OR: [
          { tenantId: lease.tenantId },
          { propertyId: lease.unit.propertyId },
        ],
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
        createdAt: 'desc',
      },
      take: 50,
    })

    const leaseWithActivities = {
      ...lease,
      activities,
    }

    return NextResponse.json(leaseWithActivities)
  } catch (error) {
    console.error("Error fetching lease:", error)
    return NextResponse.json(
      { error: "Failed to fetch lease" },
      { status: 500 }
    )
  }
}

// PATCH /api/leases/[id] - Update lease
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
    const validatedData = updateLeaseSchema.parse(body)

    // Verify lease belongs to organization
    const existingLease = await prisma.leaseAgreement.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
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

    if (!existingLease) {
      return NextResponse.json(
        { error: "Lease not found" },
        { status: 404 }
      )
    }

    // Validate date changes
    if (validatedData.startDate || validatedData.endDate) {
      const startDate = validatedData.startDate
        ? new Date(validatedData.startDate)
        : existingLease.startDate
      const endDate = validatedData.endDate
        ? new Date(validatedData.endDate)
        : existingLease.endDate

      if (startDate >= endDate) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 }
        )
      }

      // Check for overlapping leases when updating dates
      // First, check if there's an auto-renewal lease that would block this
      const autoRenewalLease = await prisma.leaseAgreement.findFirst({
        where: {
          unitId: existingLease.unitId,
          id: { not: id }, // Exclude current lease
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
          unitId: existingLease.unitId,
          id: { not: id }, // Exclude current lease
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
    }

    const updateData: any = {}
    if (validatedData.startDate !== undefined) updateData.startDate = new Date(validatedData.startDate)
    if (validatedData.endDate !== undefined) updateData.endDate = new Date(validatedData.endDate)
    if (validatedData.paymentCycle !== undefined) updateData.paymentCycle = validatedData.paymentCycle
    if (validatedData.rentAmount !== undefined) updateData.rentAmount = validatedData.rentAmount
    if (validatedData.gracePeriodDays !== undefined) updateData.gracePeriodDays = validatedData.gracePeriodDays
    if (validatedData.isAutoRenew !== undefined) updateData.isAutoRenew = validatedData.isAutoRenew
    if (validatedData.autoRenewalNoticeDays !== undefined) updateData.autoRenewalNoticeDays = validatedData.autoRenewalNoticeDays
    if (validatedData.depositAmount !== undefined) updateData.depositAmount = validatedData.depositAmount
    if (validatedData.depositStatus !== undefined) updateData.depositStatus = validatedData.depositStatus
    if (validatedData.paymentMethod !== undefined) updateData.paymentMethod = validatedData.paymentMethod

    // Handle payment status update
    if (validatedData.paidAt !== undefined) {
      if (existingLease.status === "ENDED") {
        return NextResponse.json(
          { error: "Cannot mark ended leases as paid" },
          { status: 400 }
        )
      }

      if (validatedData.paidAt === null) {
        // Mark as unpaid
        updateData.paidAt = null
        updateData.paymentStatus = "PENDING"
      } else {
        // Mark as paid
        updateData.paidAt = new Date(validatedData.paidAt)
        updateData.paymentStatus = "COMPLETED"

        // Auto-activate lease if it's in DRAFT status
        if (existingLease.status === "DRAFT") {
          updateData.status = "ACTIVE"

          // Update tenant status to ACTIVE
          await prisma.tenant.update({
            where: { id: existingLease.tenantId },
            data: { status: "ACTIVE" },
          })

          // Log activation activity
          await prisma.activity.create({
            data: {
              type: "LEASE_UPDATED",
              description: `Activated lease agreement for ${existingLease.tenant.fullName} at ${existingLease.unit.property.name} - ${existingLease.unit.name}`,
              userId: session.user.id,
              organizationId: session.user.organizationId,
              tenantId: existingLease.tenantId,
              propertyId: existingLease.unit.propertyId,
            },
          })
        }

        // Log payment activity
        await prisma.activity.create({
          data: {
            type: "PAYMENT_RECORDED",
            description: `Payment recorded for ${existingLease.tenant.fullName} at ${existingLease.unit.property.name} - ${existingLease.unit.name}`,
            userId: session.user.id,
            organizationId: session.user.organizationId,
            tenantId: existingLease.tenantId,
            propertyId: existingLease.unit.propertyId,
          },
        })
      }
    }

    // Handle status transitions
    if (validatedData.status !== undefined && validatedData.status !== existingLease.status) {
      const oldStatus = existingLease.status
      const newStatus = validatedData.status

      // Validate status transitions
      if (oldStatus === "DRAFT" && newStatus === "ACTIVE") {
        // Activate lease - update tenant to ACTIVE
        await prisma.tenant.update({
          where: { id: existingLease.tenantId },
          data: { status: "ACTIVE" },
        })
        updateData.status = "ACTIVE"
      } else if (oldStatus === "ACTIVE" && newStatus === "ENDED") {
        // End lease - check if tenant has other active leases
        const otherActiveLeases = await prisma.leaseAgreement.count({
          where: {
            tenantId: existingLease.tenantId,
            id: { not: id },
            status: "ACTIVE",
          },
        })

        // If no other active leases, mark tenant as EXPIRED
        if (otherActiveLeases === 0) {
          await prisma.tenant.update({
            where: { id: existingLease.tenantId },
            data: { status: "EXPIRED" },
          })
        }
        updateData.status = "ENDED"
      } else if (oldStatus === "ENDED") {
        return NextResponse.json(
          { error: "Cannot change status of an ended lease" },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: `Invalid status transition from ${oldStatus} to ${newStatus}` },
          { status: 400 }
        )
      }
    }

    const lease = await prisma.leaseAgreement.update({
      where: { id },
      data: updateData,
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
      },
    })

    // Log activity
    let activityType: any = "LEASE_UPDATED"
    let activityDescription = `Updated lease agreement for ${lease.tenant.fullName} at ${lease.unit.property.name} - ${lease.unit.name}`

    if (validatedData.status && validatedData.status !== existingLease.status) {
      activityType = validatedData.status === "ENDED" ? "LEASE_TERMINATED" : "LEASE_UPDATED"
      activityDescription = validatedData.status === "ENDED"
        ? `Ended lease agreement for ${lease.tenant.fullName} at ${lease.unit.property.name} - ${lease.unit.name}`
        : `Activated lease agreement for ${lease.tenant.fullName} at ${lease.unit.property.name} - ${lease.unit.name}`
    }

    await prisma.activity.create({
      data: {
        type: activityType,
        description: activityDescription,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        tenantId: lease.tenantId,
        propertyId: lease.unit.propertyId,
      },
    })

    return NextResponse.json(lease)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Error updating lease:", error)
    return NextResponse.json(
      { error: "Failed to update lease" },
      { status: 500 }
    )
  }
}

// DELETE /api/leases/[id] - Delete lease
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

    // Verify lease belongs to organization
    const existingLease = await prisma.leaseAgreement.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
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

    if (!existingLease) {
      return NextResponse.json(
        { error: "Lease not found" },
        { status: 404 }
      )
    }

    // Only allow deletion of DRAFT leases
    if (existingLease.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft leases can be deleted. Active or ended leases cannot be removed." },
        { status: 400 }
      )
    }

    await prisma.leaseAgreement.delete({
      where: { id },
    })

    // Check if tenant has other leases
    const tenantOtherLeases = await prisma.leaseAgreement.count({
      where: {
        tenantId: existingLease.tenantId,
        id: { not: id },
      },
    })

    // If no other leases, revert tenant to LEAD
    if (tenantOtherLeases === 0) {
      await prisma.tenant.update({
        where: { id: existingLease.tenantId },
        data: { status: "LEAD" },
      })
    }

    // Log activity
    await prisma.activity.create({
      data: {
        type: "LEASE_UPDATED",
        description: `Deleted draft lease for ${existingLease.tenant.fullName} at ${existingLease.unit.property.name} - ${existingLease.unit.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        tenantId: existingLease.tenantId,
        propertyId: existingLease.unit.propertyId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting lease:", error)
    return NextResponse.json(
      { error: "Failed to delete lease" },
      { status: 500 }
    )
  }
}
