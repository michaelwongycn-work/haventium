import { prisma } from "@/lib/prisma";
import { apiError } from "./response";
import type { PrismaClient } from "@prisma/client";

/**
 * Lease Validation Service
 * Complex business logic for lease validation
 */

export interface LeaseValidationResult {
  valid: boolean;
  error?: ReturnType<typeof apiError>;
}

/**
 * Validate that lease dates don't overlap with existing leases
 * @param tx - Optional Prisma transaction client for atomic operations
 */
export async function validateLeaseAvailability(
  {
    unitId,
    startDate,
    endDate,
    excludeLeaseId,
  }: {
    unitId: string;
    startDate: Date;
    endDate: Date;
    excludeLeaseId?: string;
  },
  tx?: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<LeaseValidationResult> {
  const db = tx || prisma;
  // Validate date logic
  if (startDate >= endDate) {
    return {
      valid: false,
      error: apiError("End date must be after start date", 400),
    };
  }

  // Check for auto-renewal leases that would block this booking
  const autoRenewalLease = await db.leaseAgreement.findFirst({
    where: {
      unitId,
      id: excludeLeaseId ? { not: excludeLeaseId } : undefined,
      status: {
        in: ["DRAFT", "ACTIVE"],
      },
      isAutoRenew: true,
      startDate: { lte: endDate }, // Auto-renewal lease starts before or during our end date
    },
  });

  if (autoRenewalLease) {
    return {
      valid: false,
      error: apiError(
        "Unit has an active auto-renewal lease. The lease must be ended before booking future dates.",
        400,
      ),
    };
  }

  // Check for regular overlapping leases (non-auto-renewal)
  const overlappingLease = await db.leaseAgreement.findFirst({
    where: {
      unitId,
      id: excludeLeaseId ? { not: excludeLeaseId } : undefined,
      status: {
        in: ["DRAFT", "ACTIVE"],
      },
      isAutoRenew: false,
      AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }],
    },
  });

  if (overlappingLease) {
    return {
      valid: false,
      error: apiError(
        "Unit already has an overlapping lease for these dates",
        400,
      ),
    };
  }

  return { valid: true };
}

/**
 * Check if a lease can be deleted
 */
export async function canDeleteLease(
  leaseId: string,
): Promise<LeaseValidationResult> {
  const lease = await prisma.leaseAgreement.findUnique({
    where: { id: leaseId },
    select: { status: true },
  });

  if (!lease) {
    return {
      valid: false,
      error: apiError("Lease not found", 404),
    };
  }

  // Can only delete draft leases
  if (lease.status !== "DRAFT") {
    return {
      valid: false,
      error: apiError("Only draft leases can be deleted", 400),
    };
  }

  return { valid: true };
}

/**
 * Calculate grace period deadline for a lease
 */
export function calculateGracePeriodDeadline(
  startDate: Date,
  gracePeriodDays: number,
): Date {
  const deadline = new Date(startDate);
  deadline.setDate(deadline.getDate() + gracePeriodDays);
  return deadline;
}

/**
 * Check if a lease is past its grace period
 */
export function isLeaseOverdue(
  startDate: Date,
  gracePeriodDays: number | null,
): boolean {
  if (gracePeriodDays === null) return false;

  const deadline = calculateGracePeriodDeadline(startDate, gracePeriodDays);
  return new Date() > deadline;
}
