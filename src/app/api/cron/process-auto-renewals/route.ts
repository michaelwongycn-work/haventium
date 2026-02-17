import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { LeaseAgreement, PaymentCycle } from "@prisma/client";
import { processNotifications } from "@/lib/services/notification-processor";
import { NOTIFICATION_TRIGGER } from "@/lib/constants";
import { validateLeaseAvailability } from "@/lib/api/lease-validation";

/**
 * Calculate renewal lease start and end dates based on payment cycle
 */
function calculateRenewalDates(
  originalEndDate: Date,
  paymentCycle: PaymentCycle,
): { startDate: Date; endDate: Date } {
  const startDate = new Date(originalEndDate);
  startDate.setDate(startDate.getDate() + 1);

  const endDate = new Date(startDate);

  switch (paymentCycle) {
    case "DAILY":
      endDate.setDate(endDate.getDate() + 1);
      break;
    case "MONTHLY":
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(endDate.getDate() - 1);
      break;
    case "ANNUAL":
      endDate.setFullYear(endDate.getFullYear() + 1);
      endDate.setDate(endDate.getDate() - 1);
      break;
  }

  return { startDate, endDate };
}

type LeaseWithRelations = LeaseAgreement & {
  tenant: { id: string; fullName: string };
  unit: { id: string; name: string; property: { id: string; name: string } };
};

/**
 * Create a renewal lease from an original lease
 */
async function createRenewalLease(
  originalLease: LeaseWithRelations,
): Promise<LeaseAgreement | null> {
  const { startDate, endDate } = calculateRenewalDates(
    originalLease.endDate,
    originalLease.paymentCycle,
  );

  // Validate unit availability before creating renewal lease
  const availabilityCheck = await validateLeaseAvailability({
    unitId: originalLease.unitId,
    startDate: startDate,
    endDate: endDate,
    excludeLeaseId: originalLease.id,
  });

  if (!availabilityCheck.valid) {
    console.error(
      `[process-auto-renewals] Cannot create renewal for lease ${originalLease.id}: ${availabilityCheck.error}`,
    );
    // Return null instead of throwing to allow other renewals to continue
    return null;
  }

  const result = await prisma.$transaction(async (tx) => {
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
        status: "DRAFT",
        renewedFromId: originalLease.id,
      },
    });

    await tx.leaseAgreement.update({
      where: { id: originalLease.id },
      data: { status: "ENDED" },
    });

    return newLease;
  });

  await prisma.activity.create({
    data: {
      type: "LEASE_CREATED",
      description: `Auto-renewed lease for ${originalLease.tenant.fullName} at ${originalLease.unit.property.name} - ${originalLease.unit.name}`,
      organizationId: originalLease.organizationId,
      tenantId: originalLease.tenantId,
      propertyId: originalLease.unit.property.id,
      leaseId: result.id,
      unitId: originalLease.unitId,
    },
  });

  // Trigger LEASE_EXPIRED notification for the original lease
  processNotifications({
    organizationId: originalLease.organizationId,
    trigger: NOTIFICATION_TRIGGER.LEASE_EXPIRED,
    relatedEntityId: originalLease.id,
  }).catch((err) => {
    console.error("Failed to send lease expired notification:", err);
  });

  return result;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // CRON_SECRET is required - fail if not configured
    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET environment variable not configured" },
        { status: 401 },
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      details: [] as Array<{
        leaseId: string;
        tenantName: string;
        unitName: string;
        success: boolean;
        error?: string;
      }>,
    };

    const allAutoRenewLeases = await prisma.leaseAgreement.findMany({
      where: {
        isAutoRenew: true,
        status: "ACTIVE",
        autoRenewalNoticeDays: { not: null },
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
    });

    // Filter leases where deadline has passed (endDate - noticeDays <= now)
    const now = new Date();
    const eligibleLeases = allAutoRenewLeases.filter((lease) => {
      if (!lease.autoRenewalNoticeDays) return false;

      const deadline = new Date(lease.endDate);
      deadline.setDate(deadline.getDate() - lease.autoRenewalNoticeDays);

      return now >= deadline;
    });

    for (const lease of eligibleLeases) {
      summary.processed++;

      try {
        const result = await createRenewalLease(lease);

        if (result) {
          summary.succeeded++;
          summary.details.push({
            leaseId: lease.id,
            tenantName: lease.tenant.fullName,
            unitName: `${lease.unit.property.name} - ${lease.unit.name}`,
            success: true,
          });
        } else {
          // Validation failed (unit not available)
          summary.failed++;
          summary.details.push({
            leaseId: lease.id,
            tenantName: lease.tenant.fullName,
            unitName: `${lease.unit.property.name} - ${lease.unit.name}`,
            success: false,
            error: "Unit not available for renewal (overlapping lease exists)",
          });
        }
      } catch (error) {
        summary.failed++;
        summary.details.push({
          leaseId: lease.id,
          tenantName: lease.tenant.fullName,
          unitName: `${lease.unit.property.name} - ${lease.unit.name}`,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${summary.processed} leases, ${summary.succeeded} succeeded, ${summary.failed} failed`,
      ...summary,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in process-auto-renewals cron:", error);
    return NextResponse.json(
      { error: "Failed to process auto-renewals" },
      { status: 500 },
    );
  }
}
