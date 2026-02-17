import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { processAutoRenewals } from "@/lib/lease-renewal"

/**
 * POST /api/leases/process-renewals
 * Manually trigger auto-renewal processing for all eligible leases
 * This endpoint will be called by a cron job in the future
 */
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Process renewals for this organization
    const summary = await processAutoRenewals(session.user.organizationId)

    return NextResponse.json({
      message: "Auto-renewal processing completed",
      summary,
    })
  } catch (error) {
    console.error("Error processing auto-renewals:", error)
    return NextResponse.json(
      { error: "Failed to process auto-renewals" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/leases/process-renewals
 * Check which leases are eligible for auto-renewal without processing them
 */
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { prisma } = await import("@/lib/prisma")

    // Find all leases with auto-renewal enabled
    const allAutoRenewLeases = await prisma.leaseAgreement.findMany({
      where: {
        organizationId: session.user.organizationId,
        isAutoRenew: true,
        status: "ACTIVE",
        autoRenewalNoticeDays: { not: null },
        // Check that lease hasn't been renewed already
        renewedTo: null,
      },
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
          },
        },
        unit: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    // Filter leases where deadline has passed (endDate - noticeDays <= now)
    const now = new Date()
    const eligibleLeases = allAutoRenewLeases.filter((lease) => {
      if (!lease.autoRenewalNoticeDays) return false

      const deadline = new Date(lease.endDate)
      deadline.setDate(deadline.getDate() - lease.autoRenewalNoticeDays)

      return now >= deadline
    })

    return NextResponse.json({
      count: eligibleLeases.length,
      leases: eligibleLeases.map((lease) => {
        const deadline = new Date(lease.endDate)
        deadline.setDate(deadline.getDate() - (lease.autoRenewalNoticeDays || 0))

        return {
          id: lease.id,
          tenant: lease.tenant.fullName,
          unit: `${lease.unit.property.name} - ${lease.unit.name}`,
          endDate: lease.endDate,
          autoRenewalDeadline: deadline,
        }
      }),
    })
  } catch (error) {
    console.error("Error checking eligible renewals:", error)
    return NextResponse.json(
      { error: "Failed to check eligible renewals" },
      { status: 500 }
    )
  }
}
