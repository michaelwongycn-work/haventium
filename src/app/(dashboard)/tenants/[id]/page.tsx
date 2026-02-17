"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Mail01Icon,
  SmartPhone01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

type TenantStatus = "LEAD" | "BOOKED" | "ACTIVE" | "EXPIRED"

type Tenant = {
  id: string
  fullName: string
  email: string
  phone: string
  status: TenantStatus
  preferEmail: boolean
  preferWhatsapp: boolean
  createdAt: string
  updatedAt: string
  leaseAgreements: Array<{
    id: string
    startDate: string
    endDate: string
    status: string
    rentAmount: string
    unit: {
      name: string
      property: {
        name: string
      }
    }
  }>
  activities: Array<{
    id: string
    type: string
    description: string
    createdAt: string
    user: {
      name: string
      email: string
    } | null
  }>
}

const statusColors: Record<TenantStatus, string> = {
  LEAD: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  BOOKED: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
  ACTIVE: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  EXPIRED: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
}

export default function TenantDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string>("")

  useEffect(() => {
    Promise.resolve(params).then((resolvedParams) => {
      setTenantId(resolvedParams.id)
    })
  }, [params])

  useEffect(() => {
    if (tenantId) {
      fetchTenant()
    }
  }, [tenantId])

  const fetchTenant = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/tenants/${tenantId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch tenant")
      }

      const data = await response.json()
      setTenant(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenant")
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  if (!tenant && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Tenant not found</h2>
          <p className="text-muted-foreground mb-6">
            The tenant you're looking for doesn't exist
          </p>
          <Button asChild>
            <Link href="/tenants">
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="inline-start" />
              Back to Tenants
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/tenants">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{tenant?.fullName || "Loading..."}</h1>
          <p className="text-muted-foreground mt-1">
            Tenant contact information and preferences
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[200px]" />
              <Skeleton className="h-4 w-[300px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[150px]" />
              <Skeleton className="h-4 w-[250px]" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[150px]" />
              <Skeleton className="h-4 w-[200px]" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                Primary contact details and communication preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{tenant?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={2} className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{tenant?.phone}</p>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3">Preferred Communication Channel</p>
                <div className="space-y-2 text-sm">
                  {tenant?.preferEmail && tenant?.email && (
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="h-4 w-4 text-green-500" />
                      <span>Email</span>
                    </div>
                  )}
                  {tenant?.preferWhatsapp && tenant?.phone && (
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="h-4 w-4 text-green-500" />
                      <span>WhatsApp</span>
                    </div>
                  )}
                  {!tenant?.preferEmail && !tenant?.preferWhatsapp && (
                    <p className="text-muted-foreground">No preferred channel selected</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lease Agreements */}
          <Card>
            <CardHeader>
              <CardTitle>Lease History</CardTitle>
              <CardDescription>
                All lease agreements for this tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!tenant?.leaseAgreements || tenant.leaseAgreements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No lease agreements yet
                </div>
              ) : (
                <div className="space-y-3">
                  {tenant.leaseAgreements.map((lease) => (
                    <div
                      key={lease.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div>
                        <p className="font-medium">
                          {lease.unit.property.name} - {lease.unit.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(lease.startDate).toLocaleDateString()} -{" "}
                          {new Date(lease.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(lease.rentAmount)}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {lease.status.toLowerCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Recent activity for this tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!tenant?.activities || tenant.activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No activity yet
                </div>
              ) : (
                <div className="space-y-3">
                  {tenant.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.createdAt).toLocaleString()}
                          {activity.user && ` by ${activity.user.name}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
