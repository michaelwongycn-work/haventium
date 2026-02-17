import { prisma } from "@/lib/prisma";
import { verifyCronAuth, apiSuccess, handleApiError } from "@/lib/api";
import { processNotifications } from "@/lib/services/notification-processor";
import { NOTIFICATION_TRIGGER } from "@/lib/constants";

/**
 * Cron job to process notification rules and send notifications
 *
 * Processes:
 * - PAYMENT_REMINDER: Sends reminders X days before rent is due
 * - PAYMENT_LATE: Sends notifications for overdue payments
 * - LEASE_EXPIRING: Sends notifications X days before lease ends
 *
 * Note: PAYMENT_CONFIRMED and LEASE_EXPIRED are triggered by actual events,
 * not by this cron job
 */
export async function POST(request: Request) {
  try {
    const authCheck = verifyCronAuth(request);
    if (!authCheck.authorized) return authCheck.response!;

    const now = new Date();
    const results: Record<string, unknown>[] = [];

    // Get all organizations with active notification rules
    const organizations = await prisma.organization.findMany({
      where: {
        notificationRules: {
          some: {
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    for (const org of organizations) {
      // Process PAYMENT_REMINDER notifications
      const paymentReminderResults = await processPaymentReminders(org.id, now);
      if (paymentReminderResults.processed > 0) {
        results.push({
          organization: org.name,
          trigger: "PAYMENT_REMINDER",
          ...paymentReminderResults,
        });
      }

      // Process PAYMENT_LATE notifications
      const paymentLateResults = await processPaymentLate(org.id, now);
      if (paymentLateResults.processed > 0) {
        results.push({
          organization: org.name,
          trigger: "PAYMENT_LATE",
          ...paymentLateResults,
        });
      }

      // Process LEASE_EXPIRING notifications
      const leaseExpiringResults = await processLeaseExpiring(org.id, now);
      if (leaseExpiringResults.processed > 0) {
        results.push({
          organization: org.name,
          trigger: "LEASE_EXPIRING",
          ...leaseExpiringResults,
        });
      }
    }

    return apiSuccess({
      success: true,
      message: `Processed notifications for ${organizations.length} organizations`,
      results,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "process notifications");
  }
}

/**
 * Process PAYMENT_REMINDER notifications
 * Send reminders X days before payment is due (based on payment cycle)
 *
 * For MONTHLY leases: Reminds on the same day each month (e.g., 1st of month)
 * For DAILY leases: Reminds daily
 * For ANNUAL leases: Reminds on the same day each year
 */
async function processPaymentReminders(organizationId: string, now: Date) {
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Get all active notification rules for PAYMENT_REMINDER
  const rules = await prisma.notificationRule.findMany({
    where: {
      organizationId,
      trigger: NOTIFICATION_TRIGGER.PAYMENT_REMINDER,
      isActive: true,
    },
  });

  if (rules.length === 0) return results;

  // For each rule, find leases where payment is due soon
  for (const rule of rules) {
    // Calculate when payment will be due (now + daysOffset days from now)
    const dueDateTarget = new Date(now);
    dueDateTarget.setDate(dueDateTarget.getDate() + rule.daysOffset);
    dueDateTarget.setHours(0, 0, 0, 0);

    // Find ACTIVE leases - we need to check if a payment cycle falls on the due date
    const leases = await prisma.leaseAgreement.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        startDate: {
          lte: dueDateTarget, // Lease must have started
        },
        endDate: {
          gte: dueDateTarget, // Lease must still be active
        },
      },
    });

    // Check each lease to see if a payment is due on the target date
    for (const lease of leases) {
      const paymentDue = isPaymentDueOn(lease, dueDateTarget);

      if (paymentDue) {
        const result = await processNotifications({
          organizationId,
          trigger: NOTIFICATION_TRIGGER.PAYMENT_REMINDER,
          relatedEntityId: lease.id,
        });

        results.processed += result.processed;
        results.sent += result.sent;
        results.failed += result.failed;
        results.errors.push(...result.errors);
      }
    }
  }

  return results;
}

/**
 * Check if a payment is due on a specific date based on payment cycle
 */
function isPaymentDueOn(
  lease: { startDate: Date; paymentCycle: string },
  targetDate: Date,
): boolean {
  const startDate = new Date(lease.startDate);
  startDate.setHours(0, 0, 0, 0);

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const dayOfMonth = startDate.getDate();

  switch (lease.paymentCycle) {
    case "DAILY":
      // Payment due every day
      return target >= startDate;

    case "MONTHLY":
      // Payment due on the same day each month (e.g., if start is Jan 15, due on 15th of each month)
      // Handle edge case: if start date is 29-31 and target month doesn't have that day, use last day of month
      const targetDayOfMonth = target.getDate();
      const lastDayOfTargetMonth = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0,
      ).getDate();
      const dueDayOfMonth = Math.min(dayOfMonth, lastDayOfTargetMonth);

      return targetDayOfMonth === dueDayOfMonth && target >= startDate;

    case "ANNUAL":
      // Payment due on the same date each year
      return (
        target.getMonth() === startDate.getMonth() &&
        target.getDate() === startDate.getDate() &&
        target >= startDate
      );

    default:
      return false;
  }
}

/**
 * Process PAYMENT_LATE notifications
 * Send notifications for DRAFT leases where grace period has passed
 * or ACTIVE leases where rent payment is overdue
 */
async function processPaymentLate(organizationId: string, now: Date) {
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Get all active notification rules for PAYMENT_LATE
  const rules = await prisma.notificationRule.findMany({
    where: {
      organizationId,
      trigger: NOTIFICATION_TRIGGER.PAYMENT_LATE,
      isActive: true,
    },
  });

  if (rules.length === 0) return results;

  // Find DRAFT leases where grace period has passed (unpaid bookings)
  const unpaidDraftLeases = await prisma.leaseAgreement.findMany({
    where: {
      organizationId,
      status: "DRAFT",
      paidAt: null,
      gracePeriodDays: { not: null },
      // Calculate if grace period has passed: now > startDate + gracePeriodDays
      // This is handled below as we can't directly query calculated dates
    },
  });

  // Filter by grace period expiration
  const overdueGraceLeases = unpaidDraftLeases.filter((lease) => {
    if (!lease.gracePeriodDays) return false;

    const graceDeadline = new Date(lease.startDate);
    graceDeadline.setDate(graceDeadline.getDate() + lease.gracePeriodDays);

    return now > graceDeadline;
  });

  // Process notifications for overdue grace period leases
  for (const lease of overdueGraceLeases) {
    const result = await processNotifications({
      organizationId,
      trigger: NOTIFICATION_TRIGGER.PAYMENT_LATE,
      relatedEntityId: lease.id,
    });

    results.processed += result.processed;
    results.sent += result.sent;
    results.failed += result.failed;
    results.errors.push(...result.errors);
  }

  // Note: For ACTIVE leases, payment tracking would require a separate payment records table
  // to know when each payment cycle's rent is due. Currently, the schema only tracks initial
  // payment via paidAt field. This is a limitation of the current data model.
  //
  // Future enhancement: Add a PaymentRecord table to track recurring payments
  // For now, we only handle DRAFT lease payment late notifications

  return results;
}

/**
 * Process LEASE_EXPIRING notifications
 * Send notifications X days before lease ends
 */
async function processLeaseExpiring(organizationId: string, now: Date) {
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Get all active notification rules for LEASE_EXPIRING
  const rules = await prisma.notificationRule.findMany({
    where: {
      organizationId,
      trigger: NOTIFICATION_TRIGGER.LEASE_EXPIRING,
      isActive: true,
    },
  });

  if (rules.length === 0) return results;

  // For each rule, find leases that match the daysOffset
  for (const rule of rules) {
    // Calculate target date: now + daysOffset
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + rule.daysOffset);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Find ACTIVE leases ending on the target date
    const leases = await prisma.leaseAgreement.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        endDate: {
          gte: targetDate,
          lt: nextDay,
        },
      },
    });

    // Process notifications for each lease
    for (const lease of leases) {
      const result = await processNotifications({
        organizationId,
        trigger: NOTIFICATION_TRIGGER.LEASE_EXPIRING,
        relatedEntityId: lease.id,
      });

      results.processed += result.processed;
      results.sent += result.sent;
      results.failed += result.failed;
      results.errors.push(...result.errors);
    }
  }

  return results;
}
