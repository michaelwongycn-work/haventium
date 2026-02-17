import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processNotifications } from "@/lib/services/notification-processor";

/**
 * Cron job to end expired leases and send LEASE_EXPIRED notifications
 * Schedule: Daily at 3am UTC (configured in vercel.json)
 *
 * This job:
 * 1. Finds all ACTIVE leases where endDate < now
 * 2. Transitions them to ENDED status
 * 3. Triggers LEASE_EXPIRED notifications
 * 4. Updates tenant status to EXPIRED if no other active leases remain
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret - REQUIRED
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET environment variable not configured" },
        { status: 401 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let processedCount = 0;
    let notificationResults: { organizationId: string; processed: number; sent: number; failed: number }[] = [];

    // Find all ACTIVE leases that have expired
    const expiredLeases = await prisma.leaseAgreement.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          lt: now,
        },
      },
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
        organization: true,
      },
    });

    console.log(`[end-expired-leases] Found ${expiredLeases.length} expired leases to process`);

    // Process each expired lease
    for (const lease of expiredLeases) {
      try {
        // Update lease status to ENDED
        await prisma.leaseAgreement.update({
          where: { id: lease.id },
          data: { status: "ENDED" },
        });

        // Log activity
        await prisma.activity.create({
          data: {
            organizationId: lease.organizationId,
            type: "LEASE_TERMINATED",
            description: `Lease for ${lease.tenant.fullName} at ${lease.unit.property.name} - ${lease.unit.name} ended (expired)`,
            tenantId: lease.tenantId,
            leaseId: lease.id,
            unitId: lease.unitId,
            propertyId: lease.unit.propertyId,
          },
        });

        // Check if tenant has any other active leases
        const otherActiveLeases = await prisma.leaseAgreement.count({
          where: {
            tenantId: lease.tenantId,
            status: "ACTIVE",
            id: { not: lease.id },
          },
        });

        // If no other active leases, update tenant status to EXPIRED
        if (otherActiveLeases === 0) {
          await prisma.tenant.update({
            where: { id: lease.tenantId },
            data: { status: "EXPIRED" },
          });

          await prisma.activity.create({
            data: {
              organizationId: lease.organizationId,
              type: "TENANT_STATUS_CHANGED",
              description: `Tenant ${lease.tenant.fullName} status changed to EXPIRED (all leases ended)`,
              tenantId: lease.tenantId,
            },
          });
        }

        // Trigger LEASE_EXPIRED notifications
        const notificationResult = await processNotifications({
          organizationId: lease.organizationId,
          trigger: "LEASE_EXPIRED",
          relatedEntityId: lease.id,
        });

        // Track notification results
        const existingResult = notificationResults.find(
          (r) => r.organizationId === lease.organizationId
        );
        if (existingResult) {
          existingResult.processed += notificationResult.processed;
          existingResult.sent += notificationResult.sent;
          existingResult.failed += notificationResult.failed;
        } else {
          notificationResults.push({
            organizationId: lease.organizationId,
            ...notificationResult,
          });
        }

        processedCount++;
        console.log(`[end-expired-leases] Processed lease ${lease.id} for tenant ${lease.tenant.fullName}`);
      } catch (error) {
        console.error(`[end-expired-leases] Error processing lease ${lease.id}:`, error);
        // Continue processing other leases even if one fails
      }
    }

    console.log(`[end-expired-leases] Completed: ${processedCount} leases ended`);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: expiredLeases.length,
      notifications: notificationResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[end-expired-leases] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
