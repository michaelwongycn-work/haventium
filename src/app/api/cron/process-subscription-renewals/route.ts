import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  sendSubscriptionRenewalReminderEmail,
  sendSubscriptionExpiredEmail,
} from "@/lib/mailersend";

// Reminder thresholds in days — sends one email per threshold crossing
const REMINDER_DAYS = [7, 3, 1];

export async function POST(request: Request) {
  try {
    const authCheck = verifyCronAuth(request);
    if (!authCheck.authorized) return authCheck.response!;

    const appUrl = process.env.PUBLIC_URL ?? "http://localhost:3000";
    const now = new Date();

    const summary = {
      expired: 0,
      reminded: 0,
      errors: 0,
    };

    // ──────────────────────────────────────────────
    // 1. Expire overdue active subscriptions
    // ──────────────────────────────────────────────
    const overdueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        endDate: { lt: now },
        // Exclude FREE tier (endDate = 2099)
        tier: { type: { not: "FREE" } },
      },
      include: {
        tier: { select: { name: true } },
        organization: {
          select: {
            id: true,
            name: true,
            users: {
              where: { userRoles: { some: { role: { isSystem: true } } } },
              select: { id: true, email: true, name: true },
              take: 1,
            },
          },
        },
      },
    });

    for (const sub of overdueSubscriptions) {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "EXPIRED" },
        });

        summary.expired++;

        // Send expiry email to org owner
        const owner = sub.organization.users[0];
        if (owner?.email) {
          sendSubscriptionExpiredEmail({
            to: owner.email,
            toName: owner.name ?? owner.email,
            organizationName: sub.organization.name,
            planName: sub.tier.name,
            appUrl,
          }).catch((err) => {
            logger.error("Failed to send subscription expired email", err, {
              subscriptionId: sub.id,
              organizationId: sub.organization.id,
            });
          });
        }

        logger.info("Subscription expired", {
          subscriptionId: sub.id,
          organizationId: sub.organization.id,
        });
      } catch (error) {
        summary.errors++;
        logger.cronError("process-subscription-renewals", error, {
          subscriptionId: sub.id,
          phase: "expire",
        });
      }
    }

    // ──────────────────────────────────────────────
    // 2. Send renewal reminders for upcoming expiries
    // ──────────────────────────────────────────────
    for (const daysLeft of REMINDER_DAYS) {
      // Window: subscriptions whose period ends between
      // (now + daysLeft - 1 day) and (now + daysLeft)
      // This prevents sending duplicate reminders on re-runs within the same day.
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() + daysLeft - 1);

      const windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() + daysLeft);

      const upcomingSubscriptions = await prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          endDate: { gte: windowStart, lt: windowEnd },
          tier: { type: { not: "FREE" } },
        },
        include: {
          tier: { select: { name: true } },
          organization: {
            select: {
              id: true,
              name: true,
              users: {
                where: { userRoles: { some: { role: { isSystem: true } } } },
                select: { id: true, email: true, name: true },
                take: 1,
              },
            },
          },
        },
      });

      for (const sub of upcomingSubscriptions) {
        try {
          const owner = sub.organization.users[0];
          if (!owner?.email) continue;

          await sendSubscriptionRenewalReminderEmail({
            to: owner.email,
            toName: owner.name ?? owner.email,
            organizationName: sub.organization.name,
            planName: sub.tier.name,
            billingCycle: sub.billingCycle,
            currentPeriodEnd: sub.endDate,
            daysLeft,
            appUrl,
          });

          summary.reminded++;

          logger.info("Subscription renewal reminder sent", {
            subscriptionId: sub.id,
            organizationId: sub.organization.id,
            daysLeft,
          });
        } catch (error) {
          summary.errors++;
          logger.cronError("process-subscription-renewals", error, {
            subscriptionId: sub.id,
            phase: "reminder",
            daysLeft,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Expired: ${summary.expired}, Reminders sent: ${summary.reminded}, Errors: ${summary.errors}`,
      ...summary,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    logger.cronError("process-subscription-renewals", error);
    return NextResponse.json(
      { error: "Failed to process subscription renewals" },
      { status: 500 },
    );
  }
}
