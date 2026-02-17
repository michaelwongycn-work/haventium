import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.organizationId) {
    return null
  }

  // Fetch real statistics
  const [propertyCount, unitCount, activeTenantCount, totalUnits] = await Promise.all([
    prisma.property.count({
      where: { organizationId: session.user.organizationId },
    }),
    prisma.unit.count({
      where: {
        property: {
          organizationId: session.user.organizationId,
        },
      },
    }),
    prisma.tenant.count({
      where: {
        organizationId: session.user.organizationId,
        status: "ACTIVE",
      },
    }),
    prisma.unit.findMany({
      where: {
        property: {
          organizationId: session.user.organizationId,
        },
        isUnavailable: false,
      },
      select: {
        id: true,
      },
    }),
  ])

  const availableUnitCount = totalUnits.length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name}!
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{propertyCount}</div>
            <p className="text-xs text-muted-foreground">
              {propertyCount === 0 ? "No properties yet" : `${propertyCount} ${propertyCount === 1 ? "property" : "properties"}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unitCount}</div>
            <p className="text-xs text-muted-foreground">
              {unitCount === 0 ? "No units yet" : `${availableUnitCount} available`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTenantCount}</div>
            <p className="text-xs text-muted-foreground">
              {activeTenantCount === 0 ? "No active tenants yet" : `${activeTenantCount} active ${activeTenantCount === 1 ? "tenant" : "tenants"}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Follow these steps to start managing your rental properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2">
            <li>Add your first property</li>
            <li>Create units/rooms for your property</li>
            <li>Add tenants to the system</li>
            <li>Create lease agreements</li>
            <li>Start tracking payments</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
