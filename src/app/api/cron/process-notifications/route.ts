import { prisma } from "@/lib/prisma"
import { verifyCronAuth, apiSuccess, handleApiError } from "@/lib/api"
import { processNotifications } from "@/lib/services/notification-processor"
import { NOTIFICATION_TRIGGER } from "@/lib/constants"

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
    const authCheck = verifyCronAuth(request)
    if (!authCheck.authorized) return authCheck.response!

    const now = new Date()
    const results: Record<string, unknown>[] = []

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
    })

    for (const org of organizations) {
      // Process PAYMENT_REMINDER notifications
      const paymentReminderResults = await processPaymentReminders(org.id, now)
      if (paymentReminderResults.processed > 0) {
        results.push({
          organization: org.name,
          trigger: "PAYMENT_REMINDER",
          ...paymentReminderResults,
        })
      }

      // Process PAYMENT_LATE notifications
      const paymentLateResults = await processPaymentLate(org.id, now)
      if (paymentLateResults.processed > 0) {
        results.push({
          organization: org.name,
          trigger: "PAYMENT_LATE",
          ...paymentLateResults,
        })
      }

      // Process LEASE_EXPIRING notifications
      const leaseExpiringResults = await processLeaseExpiring(org.id, now)
      if (leaseExpiringResults.processed > 0) {
        results.push({
          organization: org.name,
          trigger: "LEASE_EXPIRING",
          ...leaseExpiringResults,
        })
      }
    }

    return apiSuccess({
      success: true,
      message: `Processed notifications for ${organizations.length} organizations`,
      results,
      processedAt: now.toISOString(),
    })
  } catch (error) {
    return handleApiError(error, "process notifications")
  }
}

/**
 * Process PAYMENT_REMINDER notifications
 * Send reminders X days before payment is due (based on lease start date)
 */
async function processPaymentReminders(organizationId: string, now: Date) {
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  }

  // Get all active notification rules for PAYMENT_REMINDER
  const rules = await prisma.notificationRule.findMany({
    where: {
      organizationId,
      trigger: NOTIFICATION_TRIGGER.PAYMENT_REMINDER,
      isActive: true,
    },
  })

  if (rules.length === 0) return results

  // For each rule, find leases that match the daysOffset
  for (const rule of rules) {
    // Calculate target date: now + daysOffset
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + rule.daysOffset)
    targetDate.setHours(0, 0, 0, 0)

    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // Find ACTIVE leases where payment is due on the target date
    const leases = await prisma.leaseAgreement.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        paidAt: null, // Not yet paid
        startDate: {
          gte: targetDate,
          lt: nextDay,
        },
      },
    })

    // Process notifications for each lease
    for (const lease of leases) {
      const result = await processNotifications({
        organizationId,
        trigger: NOTIFICATION_TRIGGER.PAYMENT_REMINDER,
        relatedEntityId: lease.id,
      })

      results.processed += result.processed
      results.sent += result.sent
      results.failed += result.failed
      results.errors.push(...result.errors)
    }
  }

  return results
}

/**
 * Process PAYMENT_LATE notifications
 * Send notifications for leases where payment is overdue
 */
async function processPaymentLate(organizationId: string, now: Date) {
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  }

  // Get all active notification rules for PAYMENT_LATE
  const rules = await prisma.notificationRule.findMany({
    where: {
      organizationId,
      trigger: NOTIFICATION_TRIGGER.PAYMENT_LATE,
      isActive: true,
    },
  })

  if (rules.length === 0) return results

  // Find DRAFT leases where start date has passed (overdue)
  const overdueLeases = await prisma.leaseAgreement.findMany({
    where: {
      organizationId,
      status: "DRAFT",
      paidAt: null,
      startDate: {
        lt: now,
      },
    },
  })

  // Process notifications for each overdue lease
  for (const lease of overdueLeases) {
    const result = await processNotifications({
      organizationId,
      trigger: NOTIFICATION_TRIGGER.PAYMENT_LATE,
      relatedEntityId: lease.id,
    })

    results.processed += result.processed
    results.sent += result.sent
    results.failed += result.failed
    results.errors.push(...result.errors)
  }

  return results
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
  }

  // Get all active notification rules for LEASE_EXPIRING
  const rules = await prisma.notificationRule.findMany({
    where: {
      organizationId,
      trigger: NOTIFICATION_TRIGGER.LEASE_EXPIRING,
      isActive: true,
    },
  })

  if (rules.length === 0) return results

  // For each rule, find leases that match the daysOffset
  for (const rule of rules) {
    // Calculate target date: now + daysOffset
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + rule.daysOffset)
    targetDate.setHours(0, 0, 0, 0)

    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

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
    })

    // Process notifications for each lease
    for (const lease of leases) {
      const result = await processNotifications({
        organizationId,
        trigger: NOTIFICATION_TRIGGER.LEASE_EXPIRING,
        relatedEntityId: lease.id,
      })

      results.processed += result.processed
      results.sent += result.sent
      results.failed += result.failed
      results.errors.push(...result.errors)
    }
  }

  return results
}
