import { requireAccess, handleApiError, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { subMonths, format, startOfMonth, endOfMonth, addMonths } from "date-fns";

// GET /api/analytics
export async function GET(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "read"
    );
    if (!authorized) return response;

    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get("months") || "6";
    const months = parseInt(monthsParam, 10);

    const organizationId = session.user.organizationId;
    const now = new Date();
    const startDate = subMonths(now, months);

    // Generate array of months for the time range
    const monthLabels: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(now, i);
      monthLabels.push(format(date, "MMM yyyy"));
    }

    // 1. Monthly Revenue (Expected vs Collected)
    const monthlyRevenueData = await Promise.all(
      monthLabels.map(async (monthLabel, index) => {
        const date = subMonths(now, months - 1 - index);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);

        // Expected: sum of rentAmount for ACTIVE leases overlapping this month
        const expectedResult = await prisma.leaseAgreement.aggregate({
          _sum: { rentAmount: true },
          where: {
            organizationId,
            status: "ACTIVE",
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart },
          },
        });

        // Collected: sum of rentAmount for leases with paidAt in this month
        const collectedResult = await prisma.leaseAgreement.aggregate({
          _sum: { rentAmount: true },
          where: {
            organizationId,
            paidAt: { gte: monthStart, lte: monthEnd },
          },
        });

        return {
          month: monthLabel,
          expected: Number(expectedResult._sum.rentAmount || 0),
          collected: Number(collectedResult._sum.rentAmount || 0),
        };
      })
    );

    // 2. Occupancy Rate Trend
    const totalUnits = await prisma.unit.count({
      where: { property: { organizationId } },
    });

    const occupancyTrendData = await Promise.all(
      monthLabels.map(async (monthLabel, index) => {
        const date = subMonths(now, months - 1 - index);
        const monthEnd = endOfMonth(date);

        // Count active leases at the end of this month
        const activeLeases = await prisma.leaseAgreement.count({
          where: {
            organizationId,
            status: "ACTIVE",
            startDate: { lte: monthEnd },
            endDate: { gte: monthEnd },
          },
        });

        const rate = totalUnits > 0 ? (activeLeases / totalUnits) * 100 : 0;

        return {
          month: monthLabel,
          rate: Number(rate.toFixed(1)),
        };
      })
    );

    // Current occupancy rate
    const currentActiveLeases = await prisma.leaseAgreement.count({
      where: {
        organizationId,
        status: "ACTIVE",
      },
    });
    const occupancyRate =
      totalUnits > 0 ? (currentActiveLeases / totalUnits) * 100 : 0;

    // 3. Lease Status Distribution
    const leaseStatusCounts = await prisma.leaseAgreement.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { status: true },
    });

    const leaseStatusDistribution = leaseStatusCounts.map((item) => ({
      name: item.status,
      value: item._count.status,
    }));

    // 4. Tenant Status Distribution
    const tenantStatusCounts = await prisma.tenant.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { status: true },
    });

    const tenantStatusDistribution = tenantStatusCounts.map((item) => ({
      name: item.status,
      value: item._count.status,
    }));

    // 5. Payment Cycle Distribution (Active leases only)
    const paymentCycleCounts = await prisma.leaseAgreement.groupBy({
      by: ["paymentCycle"],
      where: { organizationId, status: "ACTIVE" },
      _count: { paymentCycle: true },
    });

    const paymentCycleDistribution = paymentCycleCounts.map((item) => ({
      name: item.paymentCycle,
      value: item._count.paymentCycle,
    }));

    // 6. Property Performance
    const properties = await prisma.property.findMany({
      where: { organizationId },
      include: {
        units: {
          include: {
            leaseAgreements: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });

    const propertyPerformance = await Promise.all(
      properties.map(async (property) => {
        const totalUnits = property.units.length;
        const occupiedUnits = property.units.filter(
          (unit) => unit.leaseAgreements.length > 0
        ).length;

        // Sum revenue from active leases
        const revenueResult = await prisma.leaseAgreement.aggregate({
          _sum: { rentAmount: true },
          where: {
            organizationId,
            status: "ACTIVE",
            unit: { propertyId: property.id },
          },
        });

        return {
          name: property.name,
          totalUnits,
          occupiedUnits,
          revenue: Number(revenueResult._sum.rentAmount || 0),
        };
      })
    );

    // 7. Upcoming Expirations (next 6 months)
    const upcomingMonths = [];
    for (let i = 0; i < 6; i++) {
      const date = addMonths(now, i);
      upcomingMonths.push({
        label: format(date, "MMM yyyy"),
        start: startOfMonth(date),
        end: endOfMonth(date),
      });
    }

    const upcomingExpirations = await Promise.all(
      upcomingMonths.map(async (month) => {
        const count = await prisma.leaseAgreement.count({
          where: {
            organizationId,
            status: "ACTIVE",
            endDate: {
              gte: month.start,
              lte: month.end,
            },
          },
        });

        return {
          month: month.label,
          count,
        };
      })
    );

    return apiSuccess({
      monthlyRevenue: monthlyRevenueData,
      occupancyRate: Number(occupancyRate.toFixed(1)),
      occupancyTrend: occupancyTrendData,
      leaseStatusDistribution,
      tenantStatusDistribution,
      paymentCycleDistribution,
      propertyPerformance,
      upcomingExpirations,
    });
  } catch (error) {
    return handleApiError(error, "fetch analytics");
  }
}
