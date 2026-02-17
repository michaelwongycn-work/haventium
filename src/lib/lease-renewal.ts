import { prisma } from "@/lib/prisma"
import type { LeaseAgreement, PaymentCycle } from "@prisma/client"

/**
 * Calculate renewal lease start and end dates based on payment cycle
 */
export function calculateRenewalDates(
  originalEndDate: Date,
  paymentCycle: PaymentCycle
): { startDate: Date; endDate: Date } {
  // Start date is the day after original lease ends
  const startDate = new Date(originalEndDate)
  startDate.setDate(startDate.getDate() + 1)

  // End date depends on payment cycle
  const endDate = new Date(startDate)

  switch (paymentCycle) {
    case "DAILY":
      endDate.setDate(endDate.getDate() + 1)
      break
    case "MONTHLY":
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(endDate.getDate() - 1)
      break
    case "ANNUAL":
      endDate.setFullYear(endDate.getFullYear() + 1)
      endDate.setDate(endDate.getDate() - 1)
      break
  }

  return { startDate, endDate }
}

/**
 * Check if a lease can still cancel auto-renewal
 * Returns true if current date is before the auto-renewal deadline
 */
export function canCancelAutoRenewal(lease: {
  endDate: Date
  autoRenewalNoticeDays: number | null
}): boolean {
  if (!lease.autoRenewalNoticeDays) return false

  const deadline = new Date(lease.endDate)
  deadline.setDate(deadline.getDate() - lease.autoRenewalNoticeDays)

  return new Date() < deadline
}

/**
 * Check if a lease should auto-renew
 */
export function shouldAutoRenew(lease: {
  isAutoRenew: boolean
  endDate: Date
  autoRenewalNoticeDays: number | null
  renewedFromId: string | null
  status: string
}): boolean {
  // Must have auto-renew enabled
  if (!lease.isAutoRenew) return false

  // Must have notice days configured
  if (!lease.autoRenewalNoticeDays) return false

  // Must be ACTIVE status
  if (lease.status !== "ACTIVE") return false

  // Must not have been renewed already
  if (lease.renewedFromId !== null) return false

  // Calculate deadline: endDate - autoRenewalNoticeDays
  const deadline = new Date(lease.endDate)
  deadline.setDate(deadline.getDate() - lease.autoRenewalNoticeDays)

  // Current date must be >= deadline (deadline has passed)
  return new Date() >= deadline
}

type LeaseWithRelations = LeaseAgreement & {
  tenant: { id: string; fullName: string }
  unit: { id: string; name: string; property: { id: string; name: string } }
}

/**
 * Create a renewal lease from an original lease
 */
export async function createRenewalLease(
  originalLease: LeaseWithRelations
): Promise<LeaseAgreement> {
  const { startDate, endDate } = calculateRenewalDates(
    originalLease.endDate,
    originalLease.paymentCycle
  )

  // Create the renewal lease in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create new lease
    const newLease = await tx.leaseAgreement.create({
      data: {
        tenantId: originalLease.tenantId,
        unitId: originalLease.unitId,
        organizationId: originalLease.organizationId,
        startDate,
        endDate,
        paymentCycle: originalLease.paymentCycle,
        rentAmount: originalLease.rentAmount,
        gracePeriodDays: originalLease.gracePeriodDays,
        isAutoRenew: originalLease.isAutoRenew,
        autoRenewalNoticeDays: originalLease.autoRenewalNoticeDays,
        depositAmount: originalLease.depositAmount,
        status: "DRAFT", // New lease starts as DRAFT
        renewedFromId: originalLease.id,
      },
    })

    // Update original lease to mark it as ENDED
    await tx.leaseAgreement.update({
      where: { id: originalLease.id },
      data: { status: "ENDED" },
    })

    return newLease
  })

  return result
}

/**
 * Process all eligible leases for auto-renewal
 * Returns summary of processed renewals
 */
export async function processAutoRenewals(organizationId?: string): Promise<{
  processed: number
  succeeded: number
  failed: number
  details: Array<{
    leaseId: string
    tenantName: string
    unitName: string
    success: boolean
    error?: string
  }>
}> {
  const summary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    details: [] as Array<{
      leaseId: string
      tenantName: string
      unitName: string
      success: boolean
      error?: string
    }>,
  }

  // Find all leases with auto-renewal enabled
  const where: any = {
    isAutoRenew: true,
    status: "ACTIVE",
    autoRenewalNoticeDays: { not: null },
    // Check that lease hasn't been renewed already
    renewedTo: null,
  }

  if (organizationId) {
    where.organizationId = organizationId
  }

  const allAutoRenewLeases = await prisma.leaseAgreement.findMany({
    where,
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

  // Process each eligible lease
  for (const lease of eligibleLeases) {
    summary.processed++

    try {
      await createRenewalLease(lease)

      summary.succeeded++
      summary.details.push({
        leaseId: lease.id,
        tenantName: lease.tenant.fullName,
        unitName: `${lease.unit.property.name} - ${lease.unit.name}`,
        success: true,
      })
    } catch (error) {
      summary.failed++
      summary.details.push({
        leaseId: lease.id,
        tenantName: lease.tenant.fullName,
        unitName: `${lease.unit.property.name} - ${lease.unit.name}`,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return summary
}
