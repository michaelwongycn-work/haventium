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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  UserIcon,
  Home01Icon,
  Calendar03Icon,
  MoneyBag02Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

type LeaseStatus = "DRAFT" | "ACTIVE" | "ENDED"
type PaymentCycle = "DAILY" | "MONTHLY" | "ANNUAL"
type DepositStatus = "HELD" | "RETURNED" | "FORFEITED"

type Lease = {
  id: string
  startDate: string
  endDate: string
  paymentCycle: PaymentCycle
  rentAmount: string | null
  gracePeriodDays: number | null
  isAutoRenew: boolean
  depositAmount: string | null
  depositStatus: DepositStatus | null
  status: LeaseStatus
  createdAt: string
  updatedAt: string
  tenant: {
    id: string
    fullName: string
    email: string
    phone: string
  }
  unit: {
    id: string
    name: string
    property: {
      id: string
      name: string
    }
  }
}

export default function LeaseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [lease, setLease] = useState<Lease | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leaseId, setLeaseId] = useState<string>("")
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    Promise.resolve(params).then((resolvedParams) => {
      setLeaseId(resolvedParams.id)
    })
  }, [params])

  useEffect(() => {
    if (leaseId) {
      fetchLease()
    }
  }, [leaseId])

  const fetchLease = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/leases/${leaseId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch lease")
      }

      const data = await response.json()
      setLease(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lease")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: LeaseStatus) => {
    if (!lease) return

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/leases/${leaseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update lease status")
      }

      await fetchLease()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lease")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDepositStatusChange = async (depositStatus: DepositStatus) => {
    if (!lease) return

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/leases/${leaseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ depositStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update deposit status")
      }

      await fetchLease()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update deposit")
    } finally {
      setIsUpdating(false)
    }
  }

  const formatCurrency = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return "—"
    const num = typeof value === "string" ? parseFloat(value) : value
    if (isNaN(num)) return "—"
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const getDaysRemaining = () => {
    if (!lease) return 0
    const today = new Date()
    const endDate = new Date(lease.endDate)
    const diffTime = endDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (!lease && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Lease not found</h2>
          <p className="text-muted-foreground mb-6">
            The lease you're looking for doesn't exist
          </p>
          <Button asChild>
            <Link href="/leases">
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="inline-start" />
              Back to Leases
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const daysRemaining = getDaysRemaining()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/leases">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {lease?.tenant.fullName || "Loading..."}
          </h1>
          <p className="text-muted-foreground mt-1">
            Lease agreement details
          </p>
        </div>
        {lease && lease.status === "ACTIVE" && daysRemaining > 0 && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Days Remaining</p>
            <p className="text-2xl font-bold">{daysRemaining}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading lease details...
        </div>
      ) : (
        <>
          {/* Lease Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Lease Overview</CardTitle>
              <CardDescription>
                General information about this lease agreement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tenant</p>
                      <Link href={`/tenants/${lease?.tenant.id}`} className="font-medium hover:underline">
                        {lease?.tenant.fullName}
                      </Link>
                      <p className="text-sm text-muted-foreground">{lease?.tenant.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <HugeiconsIcon icon={Home01Icon} strokeWidth={2} className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Property & Unit</p>
                      <Link href={`/properties/${lease?.unit.property.id}`} className="font-medium hover:underline">
                        {lease?.unit.property.name}
                      </Link>
                      <p className="text-sm">{lease?.unit.name}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Lease Period</p>
                      <p className="font-medium">
                        {lease && new Date(lease.startDate).toLocaleDateString()} - {lease && new Date(lease.endDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {lease && Math.ceil((new Date(lease.endDate).getTime() - new Date(lease.startDate).getTime()) / (1000 * 60 * 60 * 24))} days total
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <HugeiconsIcon icon={MoneyBag02Icon} strokeWidth={2} className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Rent Amount</p>
                      <p className="font-medium text-xl">{formatCurrency(lease?.rentAmount)}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        Per {lease?.paymentCycle.toLowerCase()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
              <CardDescription>
                Payment cycle and grace period settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Payment Cycle</p>
                  <p className="font-medium capitalize">{lease?.paymentCycle.toLowerCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Grace Period</p>
                  <p className="font-medium">{lease?.gracePeriodDays} days</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Auto-Renewal</p>
                  <div className="flex items-center gap-2">
                    {lease?.isAutoRenew ? (
                      <>
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Enabled</span>
                      </>
                    ) : (
                      <>
                        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Disabled</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deposit & Status Management */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposit Card */}
            {lease?.depositAmount && (
              <Card>
                <CardHeader>
                  <CardTitle>Security Deposit</CardTitle>
                  <CardDescription>
                    Deposit amount and status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Deposit Amount</p>
                    <p className="text-2xl font-bold">{formatCurrency(lease.depositAmount)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Deposit Status</Label>
                    <Select
                      value={lease.depositStatus || "HELD"}
                      onValueChange={(value) => handleDepositStatusChange(value as DepositStatus)}
                      disabled={isUpdating}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HELD">Held</SelectItem>
                        <SelectItem value="RETURNED">Returned</SelectItem>
                        <SelectItem value="FORFEITED">Forfeited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status Management Card */}
            <Card>
              <CardHeader>
                <CardTitle>Lease Status</CardTitle>
                <CardDescription>
                  Manage lease agreement status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Status</p>
                  <p className="text-2xl font-bold capitalize">{lease?.status.toLowerCase()}</p>
                </div>
                <div className="space-y-2">
                  {lease?.status === "DRAFT" && (
                    <Button
                      onClick={() => handleStatusChange("ACTIVE")}
                      disabled={isUpdating}
                      className="w-full"
                    >
                      {isUpdating ? "Activating..." : "Activate Lease"}
                    </Button>
                  )}
                  {lease?.status === "ACTIVE" && (
                    <Button
                      onClick={() => handleStatusChange("ENDED")}
                      disabled={isUpdating}
                      variant="destructive"
                      className="w-full"
                    >
                      {isUpdating ? "Ending..." : "End Lease"}
                    </Button>
                  )}
                  {lease?.status === "ENDED" && (
                    <p className="text-sm text-muted-foreground">
                      This lease has ended and cannot be modified.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{lease && new Date(lease.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{lease && new Date(lease.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
