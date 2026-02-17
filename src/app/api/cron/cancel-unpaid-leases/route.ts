import { prisma } from "@/lib/prisma";
import {
  verifyCronAuth,
  isLeaseOverdue,
  apiSuccess,
  handleApiError,
} from "@/lib/api";

/**
 * Cron job to cancel draft leases that have passed their grace period unpaid
 *
 * Logic:
 * - Find all DRAFT leases
 * - Calculate grace period deadline: startDate + gracePeriodDays
 * - If current date > grace period deadline, cancel the lease
 *
 * Example: Lease from Feb 1 to Feb 28, grace period 5 days
 * - Grace period deadline: Feb 1 + 5 days = Feb 6
 * - If today is Feb 7 and still DRAFT, cancel it
 */
export async function POST(request: Request) {
  try {
    const authCheck = verifyCronAuth(request);
    if (!authCheck.authorized) return authCheck.response!;

    const now = new Date();

    const draftLeases = await prisma.leaseAgreement.findMany({
      where: {
        status: "DRAFT",
        gracePeriodDays: {
          not: null,
        },
      },
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
      },
    });

    const cancelledLeases = [];

    for (const lease of draftLeases) {
      if (lease.gracePeriodDays === null) continue;

      if (isLeaseOverdue(lease.startDate, lease.gracePeriodDays)) {
        const gracePeriodDeadline = new Date(lease.startDate);
        gracePeriodDeadline.setDate(
          gracePeriodDeadline.getDate() + lease.gracePeriodDays,
        );

        const updatedLease = await prisma.leaseAgreement.update({
          where: { id: lease.id },
          data: { status: "CANCELLED" },
          include: {
            tenant: true,
            unit: {
              include: {
                property: true,
              },
            },
          },
        });

        await prisma.activity.create({
          data: {
            type: "LEASE_TERMINATED",
            description: `Auto-cancelled lease for ${lease.tenant.fullName} at ${lease.unit.property.name} - ${lease.unit.name} (unpaid after grace period)`,
            organizationId: lease.organizationId,
            tenantId: lease.tenantId,
            propertyId: lease.unit.propertyId,
            leaseId: lease.id,
            unitId: lease.unitId,
          },
        });

        cancelledLeases.push({
          id: updatedLease.id,
          tenant: lease.tenant.fullName,
          unit: `${lease.unit.property.name} - ${lease.unit.name}`,
          startDate: lease.startDate,
          gracePeriodDeadline,
        });
      }
    }

    return apiSuccess({
      success: true,
      message: `Processed ${draftLeases.length} draft leases, cancelled ${cancelledLeases.length}`,
      cancelledLeases,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "process unpaid leases");
  }
}
