import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { MonthYearFilter } from "./month-year-filter"

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "$0.00"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value)
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const session = await auth()

  if (!session?.user?.organizationId) {
    return null
  }

  const orgId = session.user.organizationId
  const now = new Date()
  const params = await searchParams

  const selectedMonth = params.month ? parseInt(params.month, 10) : now.getMonth() + 1
  const selectedYear = params.year ? parseInt(params.year, 10) : now.getFullYear()

  const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1)
  const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [
    propertyCount,
    unitCount,
    availableUnitCount,
    activeTenantCount,
    totalTenantCount,
    activeLeaseCount,
    draftLeaseCount,
    expectedRevenue,
    collectedRevenue,
    expiringSoonLeases,
    earliestToExpire,
  ] = await Promise.all([
    prisma.property.count({
      where: { organizationId: orgId },
    }),
    prisma.unit.count({
      where: { property: { organizationId: orgId } },
    }),
    prisma.unit.count({
      where: { property: { organizationId: orgId }, isUnavailable: false },
    }),
    prisma.tenant.count({
      where: { organizationId: orgId, status: "ACTIVE" },
    }),
    prisma.tenant.count({
      where: { organizationId: orgId },
    }),
    prisma.leaseAgreement.count({
      where: { organizationId: orgId, status: "ACTIVE" },
    }),
    prisma.leaseAgreement.count({
      where: { organizationId: orgId, status: "DRAFT" },
    }),
    prisma.leaseAgreement.aggregate({
      _sum: { rentAmount: true },
      where: {
        organizationId: orgId,
        status: "ACTIVE",
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
    }),
    prisma.leaseAgreement.aggregate({
      _sum: { rentAmount: true },
      where: {
        organizationId: orgId,
        paidAt: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    prisma.leaseAgreement.findMany({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
        endDate: { gte: now, lte: thirtyDaysFromNow },
        renewedTo: { is: null },
      },
      include: {
        tenant: { select: { fullName: true } },
        unit: { include: { property: { select: { name: true } } } },
      },
      orderBy: { endDate: "asc" },
      take: 10,
    }),
    prisma.leaseAgreement.findMany({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
        endDate: { gte: now },
      },
      include: {
        tenant: { select: { fullName: true } },
        unit: { include: { property: { select: { name: true } } } },
      },
      orderBy: { endDate: "asc" },
      take: 10,
    }),
  ])

  const unavailableUnitCount = unitCount - availableUnitCount
  const inactiveTenantCount = totalTenantCount - activeTenantCount
  const expectedRevenueAmount = expectedRevenue._sum.rentAmount ? Number(expectedRevenue._sum.rentAmount) : 0
  const collectedRevenueAmount = collectedRevenue._sum.rentAmount ? Number(collectedRevenue._sum.rentAmount) : 0
  const occupancyRate = unitCount > 0 ? Math.round((activeLeaseCount / unitCount) * 100) : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name}!
        </p>
      </div>

      {/* Row 1: Key counts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{propertyCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unitCount}</div>
            <p className="text-xs text-muted-foreground">
              {availableUnitCount} available · {unavailableUnitCount} unavailable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTenantCount}</div>
            <p className="text-xs text-muted-foreground">
              {activeTenantCount} active · {inactiveTenantCount} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Leases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLeaseCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Revenue + Occupancy */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <CardAction>
              <MonthYearFilter currentMonth={selectedMonth} currentYear={selectedYear} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(collectedRevenueAmount)}</div>
            <p className="text-xs text-muted-foreground">
              Expected: {formatCurrency(expectedRevenueAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Draft Leases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftLeaseCount}</div>
            <p className="text-xs text-muted-foreground">
              Pending lease agreements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {activeLeaseCount} of {unitCount} units occupied
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Expiring Soon + Earliest to Expire */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expiring Soon ({expiringSoonLeases.length})</CardTitle>
            <CardDescription>
              Active leases expiring within 30 days with no renewal
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expiringSoonLeases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No leases expiring soon without a renewal
              </p>
            ) : (
              <div className="space-y-3">
                {expiringSoonLeases.map((lease) => {
                  const endDate = new Date(lease.endDate)
                  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <Link
                      key={lease.id}
                      href={`/leases/${lease.id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{lease.tenant.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {lease.unit.property.name} - {lease.unit.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{daysLeft}d left</p>
                        <p className="text-xs text-muted-foreground">
                          {endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earliest to Expire</CardTitle>
            <CardDescription>
              Active leases sorted by earliest end date
            </CardDescription>
          </CardHeader>
          <CardContent>
            {earliestToExpire.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active leases
              </p>
            ) : (
              <div className="space-y-3">
                {earliestToExpire.map((lease) => {
                  const endDate = new Date(lease.endDate)
                  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <Link
                      key={lease.id}
                      href={`/leases/${lease.id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{lease.tenant.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {lease.unit.property.name} - {lease.unit.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{daysLeft}d left</p>
                        <p className="text-xs text-muted-foreground">
                          {endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
