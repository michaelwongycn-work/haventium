import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { processNotifications } from "@/lib/services/notification-processor";
import { NOTIFICATION_TRIGGER } from "@/lib/constants";

const updateLeaseSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentCycle: z.enum(["DAILY", "MONTHLY", "ANNUAL"]).optional(),
  rentAmount: z.number().min(0, "Rent amount must be positive").optional(),
  isAutoRenew: z.boolean().optional(),
  gracePeriodDays: z
    .number()
    .min(0, "Grace period must be positive")
    .optional()
    .nullable(),
  autoRenewalNoticeDays: z
    .number()
    .min(1, "Notice period must be at least 1 day")
    .optional()
    .nullable(),
  depositAmount: z
    .number()
    .min(0, "Deposit amount must be positive")
    .optional()
    .nullable(),
  depositStatus: z.enum(["HELD", "RETURNED", "FORFEITED"]).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ENDED"]).optional(),
  paidAt: z.string().nullable().optional(),
  paymentMethod: z
    .enum(["CASH", "BANK_TRANSFER", "VIRTUAL_ACCOUNT", "QRIS", "MANUAL"])
    .optional(),
});

// GET /api/leases/[id] - Get single lease
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await checkAccess(
      "leases",
      "read",
    );
    if (!authorized) return response;

    const { id } = await params;

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
        renewedFrom: {
          select: { id: true, startDate: true, endDate: true, status: true },
        },
        renewedTo: {
          select: { id: true, startDate: true, endDate: true, status: true },
        },
      },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const activities = await prisma.activity.findMany({
      where: {
        organizationId: session.user.organizationId,
        leaseId: id,
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
        createdAt: "desc",
      },
      take: 50,
    });

    const leaseWithActivities = {
      ...lease,
      activities,
    };

    return NextResponse.json(leaseWithActivities);
  } catch (error) {
    console.error("Error fetching lease:", error);
    return NextResponse.json(
      { error: "Failed to fetch lease" },
      { status: 500 },
    );
  }
}

// PATCH /api/leases/[id] - Update lease
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await checkAccess(
      "leases",
      "update",
    );
    if (!authorized) return response;

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateLeaseSchema.parse(body);

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
    });

    if (!existingLease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    // Block general field edits for non-DRAFT leases (only allow auto-renewal, payment, status, and deposit status changes)
    if (existingLease.status !== "DRAFT") {
      const draftOnlyFields = [
        "startDate",
        "endDate",
        "paymentCycle",
        "rentAmount",
        "depositAmount",
      ] as const;
      const attemptedDraftFields = draftOnlyFields.filter(
        (f) => validatedData[f] !== undefined,
      );
      if (attemptedDraftFields.length > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot edit lease details after it has been activated. Only auto-renewal settings can be changed.",
          },
          { status: 400 },
        );
      }
    }

    // Deposit status can only be changed for ENDED leases that haven't been renewed and are still HELD
    if (validatedData.depositStatus !== undefined) {
      if (existingLease.status !== "ENDED") {
        return NextResponse.json(
          { error: "Deposit status can only be changed for ended leases" },
          { status: 400 },
        );
      }

      const renewedTo = await prisma.leaseAgreement.findFirst({
        where: { renewedFromId: id },
      });
      if (renewedTo) {
        return NextResponse.json(
          { error: "Deposit status cannot be changed for renewed leases" },
          { status: 400 },
        );
      }

      if (
        existingLease.depositStatus &&
        existingLease.depositStatus !== "HELD"
      ) {
        return NextResponse.json(
          {
            error: "Deposit status can only be changed while it is still held",
          },
          { status: 400 },
        );
      }
    }

    // Block any auto-renewal changes after notice period deadline
    if (
      existingLease.isAutoRenew &&
      existingLease.status === "ACTIVE" &&
      existingLease.autoRenewalNoticeDays
    ) {
      const deadline = new Date(existingLease.endDate);
      deadline.setDate(
        deadline.getDate() - existingLease.autoRenewalNoticeDays,
      );
      if (new Date() >= deadline) {
        const autoRenewFields = [
          "isAutoRenew",
          "gracePeriodDays",
          "autoRenewalNoticeDays",
        ] as const;
        const attemptedFields = autoRenewFields.filter(
          (f) => validatedData[f] !== undefined,
        );
        if (attemptedFields.length > 0) {
          return NextResponse.json(
            {
              error:
                "Cannot modify auto-renewal settings after the notice period deadline has passed",
            },
            { status: 400 },
          );
        }
      }
    }

    // Block enabling auto-renewal if another renter exists in the next cycle
    if (
      validatedData.isAutoRenew === true &&
      !existingLease.isAutoRenew &&
      existingLease.status === "ACTIVE"
    ) {
      const futureLeaseOnUnit = await prisma.leaseAgreement.findFirst({
        where: {
          unitId: existingLease.unitId,
          id: { not: id },
          status: { in: ["DRAFT", "ACTIVE"] },
          startDate: { gt: existingLease.endDate },
        },
      });
      if (futureLeaseOnUnit) {
        return NextResponse.json(
          {
            error:
              "Cannot enable auto-renewal because another lease is scheduled for this unit after the current period",
          },
          { status: 400 },
        );
      }
    }

    // Validate date changes
    if (validatedData.startDate || validatedData.endDate) {
      const startDate = validatedData.startDate
        ? new Date(validatedData.startDate)
        : existingLease.startDate;
      const endDate = validatedData.endDate
        ? new Date(validatedData.endDate)
        : existingLease.endDate;

      if (startDate >= endDate) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 },
        );
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
      });

      if (autoRenewalLease) {
        return NextResponse.json(
          {
            error:
              "Unit has an active auto-renewal lease. The lease must be ended before booking future dates.",
          },
          { status: 400 },
        );
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
      });

      if (overlappingLease) {
        return NextResponse.json(
          { error: "Unit already has an overlapping lease for these dates" },
          { status: 400 },
        );
      }
    }

    const updateData: Record<string, string | number | boolean | Date | null> =
      {};
    if (validatedData.startDate !== undefined)
      updateData.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate !== undefined)
      updateData.endDate = new Date(validatedData.endDate);
    if (validatedData.paymentCycle !== undefined)
      updateData.paymentCycle = validatedData.paymentCycle;
    if (validatedData.rentAmount !== undefined)
      updateData.rentAmount = validatedData.rentAmount;
    if (validatedData.gracePeriodDays !== undefined)
      updateData.gracePeriodDays = validatedData.gracePeriodDays;
    if (validatedData.isAutoRenew !== undefined)
      updateData.isAutoRenew = validatedData.isAutoRenew;
    if (validatedData.autoRenewalNoticeDays !== undefined)
      updateData.autoRenewalNoticeDays = validatedData.autoRenewalNoticeDays;
    if (validatedData.depositAmount !== undefined)
      updateData.depositAmount = validatedData.depositAmount;
    if (validatedData.depositStatus !== undefined)
      updateData.depositStatus = validatedData.depositStatus;
    if (validatedData.paymentMethod !== undefined)
      updateData.paymentMethod = validatedData.paymentMethod;

    // Handle payment status update
    if (validatedData.paidAt !== undefined) {
      if (existingLease.status === "ENDED") {
        return NextResponse.json(
          { error: "Cannot mark ended leases as paid" },
          { status: 400 },
        );
      }

      if (validatedData.paidAt === null) {
        // Mark as unpaid
        updateData.paidAt = null;
        updateData.paymentStatus = "PENDING";
      } else {
        // Mark as paid
        updateData.paidAt = new Date(validatedData.paidAt);
        updateData.paymentStatus = "COMPLETED";

        // Auto-activate lease if it's in DRAFT status
        if (existingLease.status === "DRAFT") {
          updateData.status = "ACTIVE";
          // Tenant status update will be done atomically with lease update below
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
            leaseId: id,
            unitId: existingLease.unitId,
          },
        });

        // Trigger PAYMENT_CONFIRMED notification
        processNotifications({
          organizationId: session.user.organizationId,
          trigger: NOTIFICATION_TRIGGER.PAYMENT_CONFIRMED,
          relatedEntityId: id,
        }).catch((err) => {
          console.error(
            "Failed to send payment confirmation notification:",
            err,
          );
        });
      }
    }

    // Handle status transitions
    if (
      validatedData.status !== undefined &&
      validatedData.status !== existingLease.status
    ) {
      const oldStatus = existingLease.status;
      const newStatus = validatedData.status;

      // Validate status transitions
      if (oldStatus === "DRAFT" && newStatus === "ACTIVE") {
        // Activate lease - tenant status update will be done atomically below
        updateData.status = "ACTIVE";
      } else if (oldStatus === "ACTIVE" && newStatus === "ENDED") {
        // End lease - tenant status update will be done atomically below
        updateData.status = "ENDED";
      } else if (oldStatus === "ENDED") {
        return NextResponse.json(
          { error: "Cannot change status of an ended lease" },
          { status: 400 },
        );
      } else {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${oldStatus} to ${newStatus}`,
          },
          { status: 400 },
        );
      }
    }

    // Update lease and tenant status atomically in a transaction
    const lease = await prisma.$transaction(async (tx) => {
      // Check if we need to update tenant status based on lease status change
      const wasActivating =
        existingLease.status === "DRAFT" && updateData.status === "ACTIVE";
      const wasEnding =
        existingLease.status === "ACTIVE" && updateData.status === "ENDED";

      // Update the lease
      const updatedLease = await tx.leaseAgreement.update({
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
      });

      // Handle tenant status updates atomically
      if (wasActivating) {
        // Activating lease - set tenant to ACTIVE
        await tx.tenant.update({
          where: { id: existingLease.tenantId },
          data: { status: "ACTIVE" },
        });

        // Log activation activity
        await tx.activity.create({
          data: {
            type: "LEASE_UPDATED",
            description: `Activated lease agreement for ${existingLease.tenant.fullName} at ${existingLease.unit.property.name} - ${existingLease.unit.name}`,
            userId: session.user.id,
            organizationId: session.user.organizationId,
            tenantId: existingLease.tenantId,
            propertyId: existingLease.unit.propertyId,
            leaseId: id,
            unitId: existingLease.unitId,
          },
        });
      } else if (wasEnding) {
        // Ending lease - check if tenant has other active leases
        const otherActiveLeases = await tx.leaseAgreement.count({
          where: {
            tenantId: existingLease.tenantId,
            id: { not: id },
            status: "ACTIVE",
          },
        });

        // If no other active leases, mark tenant as EXPIRED
        if (otherActiveLeases === 0) {
          await tx.tenant.update({
            where: { id: existingLease.tenantId },
            data: { status: "EXPIRED" },
          });
        }
      }

      return updatedLease;
    });

    // Log activity
    let activityType: "LEASE_UPDATED" | "LEASE_TERMINATED" = "LEASE_UPDATED";
    let activityDescription = `Updated lease agreement for ${lease.tenant.fullName} at ${lease.unit.property.name} - ${lease.unit.name}`;

    if (validatedData.status && validatedData.status !== existingLease.status) {
      activityType =
        validatedData.status === "ENDED" ? "LEASE_TERMINATED" : "LEASE_UPDATED";
      activityDescription =
        validatedData.status === "ENDED"
          ? `Ended lease agreement for ${lease.tenant.fullName} at ${lease.unit.property.name} - ${lease.unit.name}`
          : `Activated lease agreement for ${lease.tenant.fullName} at ${lease.unit.property.name} - ${lease.unit.name}`;
    }

    await prisma.activity.create({
      data: {
        type: activityType,
        description: activityDescription,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        tenantId: lease.tenantId,
        propertyId: lease.unit.propertyId,
        leaseId: lease.id,
        unitId: lease.unitId,
      },
    });

    return NextResponse.json(lease);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      );
    }

    console.error("Error updating lease:", error);
    return NextResponse.json(
      { error: "Failed to update lease" },
      { status: 500 },
    );
  }
}

// DELETE /api/leases/[id] - Delete lease
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await checkAccess(
      "leases",
      "delete",
    );
    if (!authorized) return response;

    const { id } = await params;

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
    });

    if (!existingLease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    // Only allow deletion of DRAFT leases
    if (existingLease.status !== "DRAFT") {
      return NextResponse.json(
        {
          error:
            "Only draft leases can be deleted. Active or ended leases cannot be removed.",
        },
        { status: 400 },
      );
    }

    // Prevent deletion of leases in a renewal chain
    if (existingLease.renewedFromId || existingLease.renewedTo) {
      return NextResponse.json(
        {
          error:
            "Cannot delete leases that are part of a renewal chain. This lease has been renewed from or to another lease.",
        },
        { status: 400 },
      );
    }

    // Log activity before deletion so leaseId FK is valid
    await prisma.activity.create({
      data: {
        type: "LEASE_UPDATED",
        description: `Deleted draft lease for ${existingLease.tenant.fullName} at ${existingLease.unit.property.name} - ${existingLease.unit.name}`,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        tenantId: existingLease.tenantId,
        propertyId: existingLease.unit.propertyId,
        leaseId: id,
        unitId: existingLease.unitId,
      },
    });

    await prisma.leaseAgreement.delete({
      where: { id },
    });

    // Check if tenant has other leases
    const tenantOtherLeases = await prisma.leaseAgreement.count({
      where: {
        tenantId: existingLease.tenantId,
        id: { not: id },
      },
    });

    // If no other leases, revert tenant to LEAD
    if (tenantOtherLeases === 0) {
      await prisma.tenant.update({
        where: { id: existingLease.tenantId },
        data: { status: "LEAD" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lease:", error);
    return NextResponse.json(
      { error: "Failed to delete lease" },
      { status: 500 },
    );
  }
}
