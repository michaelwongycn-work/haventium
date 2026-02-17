import { requireAccess, handleApiError, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// GET /api/dashboard/overview
export async function GET(request: NextRequest) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "read"
    );
    if (!authorized) return response;

    const organizationId = session.user.organizationId;
    const searchParams = request.nextUrl.searchParams;

    // Parse month/year from query params (default to current)
    const now = new Date();
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

    // Calculate month date range for revenue
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Run all queries in parallel
    const [
      propertyCount,
      unitCount,
      unavailableUnitCount,
      activeTenantCount,
      totalTenantCount,
      activeLeaseCount,
      draftLeaseCount,
      expectedRevenue,
      collectedRevenue,
      expiringSoon,
      earliestToExpire,
    ] = await Promise.all([
      // Property count
      prisma.property.count({
        where: { organizationId },
      }),

      // Unit count
      prisma.unit.count({
        where: { property: { organizationId } },
      }),

      // Unavailable unit count
      prisma.unit.count({
        where: { property: { organizationId }, isUnavailable: true },
      }),

      // Active tenant count
      prisma.tenant.count({
        where: { organizationId, status: "ACTIVE" },
      }),

      // Total tenant count
      prisma.tenant.count({
        where: { organizationId },
      }),

      // Active lease count
      prisma.leaseAgreement.count({
        where: { organizationId, status: "ACTIVE" },
      }),

      // Draft lease count
      prisma.leaseAgreement.count({
        where: { organizationId, status: "DRAFT" },
      }),

      // Expected revenue for month
      prisma.leaseAgreement.aggregate({
        where: {
          organizationId,
          status: "ACTIVE",
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        _sum: {
          rentAmount: true,
        },
      }),

      // Collected revenue for month
      prisma.leaseAgreement.aggregate({
        where: {
          organizationId,
          paidAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          rentAmount: true,
        },
      }),

      // Expiring soon (active leases ending within 30 days, no renewal)
      prisma.leaseAgreement.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
          endDate: {
            gte: now,
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
          renewedTo: { is: null },
        },
        include: {
          tenant: { select: { fullName: true } },
          unit: {
            include: {
              property: { select: { name: true } },
            },
          },
        },
        orderBy: {
          endDate: "asc",
        },
        take: 10,
      }),

      // Upcoming payments (unpaid DRAFT/ACTIVE leases sorted by start date)
      prisma.leaseAgreement.findMany({
        where: {
          organizationId,
          status: { in: ["DRAFT", "ACTIVE"] },
          paidAt: null,
          startDate: { gte: now },
        },
        include: {
          tenant: { select: { fullName: true } },
          unit: {
            include: {
              property: { select: { name: true } },
            },
          },
        },
        orderBy: {
          startDate: "asc",
        },
        take: 10,
      }),
    ]);

    const availableUnitCount = unitCount - unavailableUnitCount;
    const occupancyRate = unitCount > 0 ? (activeLeaseCount / unitCount) * 100 : 0;

    return apiSuccess({
      counts: {
        properties: propertyCount,
        units: unitCount,
        availableUnits: availableUnitCount,
        activeTenants: activeTenantCount,
        totalTenants: totalTenantCount,
        activeLeases: activeLeaseCount,
        draftLeases: draftLeaseCount,
      },
      revenue: {
        expected: expectedRevenue._sum.rentAmount?.toNumber() || 0,
        collected: collectedRevenue._sum.rentAmount?.toNumber() || 0,
        month,
        year,
      },
      occupancy: {
        rate: parseFloat(occupancyRate.toFixed(1)),
        activeLeases: activeLeaseCount,
        totalUnits: unitCount,
      },
      expiringSoon,
      upcomingPayments: earliestToExpire,
    });
  } catch (error) {
    return handleApiError(error, "fetch dashboard overview");
  }
}
