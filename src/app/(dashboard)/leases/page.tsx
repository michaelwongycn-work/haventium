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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  File02Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

type LeaseStatus = "DRAFT" | "ACTIVE" | "ENDED"
type PaymentCycle = "DAILY" | "MONTHLY" | "ANNUAL"

type Lease = {
  id: string
  tenantId: string
  unitId: string
  startDate: string
  endDate: string
  paymentCycle: PaymentCycle
  rentAmount: string
  gracePeriodDays: number
  isAutoRenew: boolean
  autoRenewalNoticeDays: number | null
  depositAmount: string | null
  paidAt: string | null
  status: LeaseStatus
  createdAt: string
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

type Tenant = {
  id: string
  fullName: string
  email: string
}

type Property = {
  id: string
  name: string
  units: Unit[]
}

type Unit = {
  id: string
  name: string
  dailyRate: string | null
  monthlyRate: string | null
  annualRate: string | null
}

export default function LeasesPage() {
  const [leases, setLeases] = useState<Lease[]>([])
  const [filteredLeases, setFilteredLeases] = useState<Lease[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingLease, setEditingLease] = useState<Lease | null>(null)
  const [deletingLease, setDeletingLease] = useState<Lease | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const [createdLease, setCreatedLease] = useState<Lease | null>(null)

  const [formData, setFormData] = useState({
    tenantId: "",
    propertyId: "",
    unitId: "",
    startDate: "",
    endDate: "",
    paymentCycle: "MONTHLY" as PaymentCycle,
    rentAmount: "",
    gracePeriodDays: 3,
    isAutoRenew: false,
    autoRenewalNoticeDays: 5,
    depositAmount: "",
  })

  useEffect(() => {
    fetchLeases()
    fetchTenants()
    fetchProperties()
  }, [])

  useEffect(() => {
    filterLeases()
  }, [leases, statusFilter, searchQuery])

  const fetchLeases = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/leases")

      if (!response.ok) {
        throw new Error("Failed to fetch leases")
      }

      const data = await response.json()
      setLeases(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leases")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTenants = async () => {
    try {
      const response = await fetch("/api/tenants")
      if (response.ok) {
        const data = await response.json()
        setTenants(data)
      }
    } catch (err) {
      console.error("Error fetching tenants:", err)
    }
  }

  const fetchProperties = async () => {
    try {
      const response = await fetch("/api/properties")
      if (response.ok) {
        const data = await response.json()

        // Fetch units for each property
        const propertiesWithUnits = await Promise.all(
          data.map(async (property: any) => {
            const unitsResponse = await fetch(`/api/properties/${property.id}/units`)
            if (unitsResponse.ok) {
              const units = await unitsResponse.json()
              return { ...property, units: units.filter((u: any) => !u.isUnavailable) }
            }
            return { ...property, units: [] }
          })
        )

        setProperties(propertiesWithUnits)
      }
    } catch (err) {
      console.error("Error fetching properties:", err)
    }
  }

  const filterLeases = () => {
    let filtered = leases

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((lease) => lease.status === statusFilter)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (lease) =>
          lease.tenant.fullName.toLowerCase().includes(query) ||
          lease.unit.name.toLowerCase().includes(query) ||
          lease.unit.property.name.toLowerCase().includes(query)
      )
    }

    setFilteredLeases(filtered)
  }

  const selectedProperty = properties.find(p => p.id === formData.propertyId)
  const availableUnits = selectedProperty?.units || []

  const handleOpenDialog = (lease?: Lease) => {
    if (lease) {
      setEditingLease(lease)
      setFormData({
        tenantId: lease.tenantId,
        propertyId: lease.unit.property.id,
        unitId: lease.unitId,
        startDate: lease.startDate.split("T")[0],
        endDate: lease.endDate.split("T")[0],
        paymentCycle: lease.paymentCycle,
        rentAmount: lease.rentAmount,
        gracePeriodDays: lease.gracePeriodDays || 3,
        isAutoRenew: lease.isAutoRenew,
        autoRenewalNoticeDays: lease.autoRenewalNoticeDays || 5,
        depositAmount: lease.depositAmount || "",
      })
    } else {
      setEditingLease(null)
      setFormData({
        tenantId: "",
        propertyId: "",
        unitId: "",
        startDate: "",
        endDate: "",
        paymentCycle: "MONTHLY",
        rentAmount: "",
        gracePeriodDays: 3,
        isAutoRenew: false,
        autoRenewalNoticeDays: 5,
        depositAmount: "",
      })
    }
    setError(null)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingLease(null)
    setFormData({
      tenantId: "",
      propertyId: "",
      unitId: "",
      startDate: "",
      endDate: "",
      paymentCycle: "MONTHLY",
      rentAmount: "",
      gracePeriodDays: 3,
      isAutoRenew: false,
      autoRenewalNoticeDays: 5,
      depositAmount: "",
    })
    setError(null)
  }

  const handlePropertyChange = (propertyId: string) => {
    setFormData({ ...formData, propertyId, unitId: "" })
  }

  const handleUnitChange = (unitId: string) => {
    const unit = availableUnits.find(u => u.id === unitId)
    if (unit) {
      // Determine first available payment cycle
      let firstAvailableCycle: PaymentCycle = "MONTHLY"
      let suggestedRent = ""

      if (unit.dailyRate) {
        firstAvailableCycle = "DAILY"
        suggestedRent = unit.dailyRate
      } else if (unit.monthlyRate) {
        firstAvailableCycle = "MONTHLY"
        suggestedRent = unit.monthlyRate
      } else if (unit.annualRate) {
        firstAvailableCycle = "ANNUAL"
        suggestedRent = unit.annualRate
      }

      setFormData({
        ...formData,
        unitId,
        paymentCycle: firstAvailableCycle,
        rentAmount: suggestedRent || formData.rentAmount
      })
    }
  }

  const handlePaymentCycleChange = (paymentCycle: PaymentCycle) => {
    const unit = availableUnits.find(u => u.id === formData.unitId)
    if (unit) {
      let suggestedRent = ""
      if (paymentCycle === "DAILY" && unit.dailyRate) {
        suggestedRent = unit.dailyRate
      } else if (paymentCycle === "MONTHLY" && unit.monthlyRate) {
        suggestedRent = unit.monthlyRate
      } else if (paymentCycle === "ANNUAL" && unit.annualRate) {
        suggestedRent = unit.annualRate
      }

      // Auto-calculate end date based on payment cycle
      let newEndDate = formData.endDate
      if (formData.startDate) {
        const start = new Date(formData.startDate)
        if (paymentCycle === "DAILY") {
          start.setDate(start.getDate() + 1)
        } else if (paymentCycle === "MONTHLY") {
          start.setMonth(start.getMonth() + 1)
          start.setDate(start.getDate() - 1)
        } else if (paymentCycle === "ANNUAL") {
          start.setFullYear(start.getFullYear() + 1)
          start.setDate(start.getDate() - 1)
        }
        newEndDate = start.toISOString().split("T")[0]
      }

      setFormData({ ...formData, paymentCycle, rentAmount: suggestedRent || formData.rentAmount, endDate: newEndDate })
    } else {
      setFormData({ ...formData, paymentCycle })
    }
  }

  const handleStartDateChange = (startDate: string) => {
    if (!startDate) {
      setFormData({ ...formData, startDate, endDate: "" })
      return
    }

    // Auto-calculate end date based on payment cycle
    const start = new Date(startDate)
    let endDate = new Date(startDate)

    if (formData.paymentCycle === "DAILY") {
      endDate.setDate(endDate.getDate() + 1)
    } else if (formData.paymentCycle === "MONTHLY") {
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(endDate.getDate() - 1)
    } else if (formData.paymentCycle === "ANNUAL") {
      endDate.setFullYear(endDate.getFullYear() + 1)
      endDate.setDate(endDate.getDate() - 1)
    }

    setFormData({
      ...formData,
      startDate,
      endDate: endDate.toISOString().split("T")[0]
    })
  }

  const parseCurrencyInput = (value: string): string => {
    // Remove any non-numeric characters except decimal point
    return value.replace(/[^\d.]/g, "")
  }

  const getLatestPaymentDate = () => {
    if (!formData.startDate) return null

    const startDate = new Date(formData.startDate)
    // Calculate first payment date based on payment cycle
    const firstPaymentDate = new Date(startDate)
    
    if (formData.paymentCycle === "DAILY") {
      firstPaymentDate.setDate(firstPaymentDate.getDate() + 1)
    } else if (formData.paymentCycle === "MONTHLY") {
      firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1)
    } else if (formData.paymentCycle === "ANNUAL") {
      firstPaymentDate.setFullYear(firstPaymentDate.getFullYear() + 1)
    }
    
    // Add grace period to first payment date
    firstPaymentDate.setDate(firstPaymentDate.getDate() + formData.gracePeriodDays)

    return firstPaymentDate
  }

  const isPaymentCycleAvailable = (cycle: PaymentCycle) => {
    const unit = availableUnits.find(u => u.id === formData.unitId)
    if (!unit) return false

    if (cycle === "DAILY") return !!unit.dailyRate
    if (cycle === "MONTHLY") return !!unit.monthlyRate
    if (cycle === "ANNUAL") return !!unit.annualRate
    return false
  }

  const handleSaveLease = async () => {
    if (!formData.tenantId) {
      setError("Please select a tenant")
      return
    }

    if (!formData.unitId) {
      setError("Please select a property and unit")
      return
    }

    if (!formData.startDate || !formData.endDate) {
      setError("Please enter start and end dates")
      return
    }

    const rentAmount = parseFloat(parseCurrencyInput(formData.rentAmount))
    if (isNaN(rentAmount) || rentAmount <= 0) {
      setError("Please enter a valid rent amount")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const url = editingLease
        ? `/api/leases/${editingLease.id}`
        : "/api/leases"

      const method = editingLease ? "PATCH" : "POST"

      const payload: any = {
        startDate: formData.startDate,
        endDate: formData.endDate,
        paymentCycle: formData.paymentCycle,
        rentAmount,
        gracePeriodDays: formData.isAutoRenew ? formData.gracePeriodDays : null,
        isAutoRenew: formData.isAutoRenew,
        autoRenewalNoticeDays: formData.isAutoRenew ? formData.autoRenewalNoticeDays : null,
      }

      if (!editingLease) {
        payload.tenantId = formData.tenantId
        payload.unitId = formData.unitId
      }

      if (formData.depositAmount) {
        payload.depositAmount = parseFloat(formData.depositAmount)
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save lease")
      }

      await fetchLeases()
      
      // Show success dialog for both create and update
      setCreatedLease(data)
      setIsSuccessDialogOpen(true)
      
      handleCloseDialog()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lease")
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenDeleteDialog = (lease: Lease) => {
    setDeletingLease(lease)
    setIsDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false)
    setDeletingLease(null)
  }

  const handleDeleteLease = async () => {
    if (!deletingLease) return

    setIsSaving(true)

    try {
      const response = await fetch(`/api/leases/${deletingLease.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete lease")
      }

      await fetchLeases()
      handleCloseDeleteDialog()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lease")
    } finally {
      setIsSaving(false)
    }
  }

  const handleTogglePaidStatus = async (lease: Lease) => {
    try {
      const newPaidAt = lease.paidAt ? null : new Date().toISOString()

      const response = await fetch(`/api/leases/${lease.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paidAt: newPaidAt }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update payment status")
      }

      await fetchLeases()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment status")
    }
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value
    if (isNaN(num)) return "—"
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lease Agreements</h1>
          <p className="text-muted-foreground mt-1">
            Manage your rental lease agreements
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
          Add Lease
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Leases</CardTitle>
              <CardDescription>
                A list of all your lease agreements
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  strokeWidth={2}
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                />
                <Input
                  placeholder="Search leases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[250px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ENDED">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Auto-Renew</TableHead>
                  <TableHead>Grace</TableHead>
                  <TableHead>Notice</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[70px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                    <TableCell><Skeleton className="h-7 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : filteredLeases.length === 0 ? (
            <div className="text-center py-12">
              <HugeiconsIcon
                icon={File02Icon}
                strokeWidth={1.5}
                className="mx-auto h-12 w-12 text-muted-foreground mb-4"
              />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery || statusFilter !== "all"
                  ? "No leases found"
                  : "No leases yet"}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by creating your first lease agreement"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => handleOpenDialog()}>
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
                  Add Lease
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property / Unit</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Rent Amount</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Auto-Renewal</TableHead>
                  <TableHead>Grace Period</TableHead>
                  <TableHead>Notice Period</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeases.map((lease) => (
                  <TableRow
                    key={lease.id}
                    className="cursor-pointer"
                    onClick={() => window.location.href = `/leases/${lease.id}`}
                  >
                    <TableCell className="font-medium">
                      {lease.tenant.fullName}
                    </TableCell>
                    <TableCell>
                      {lease.unit.property.name} - {lease.unit.name}
                    </TableCell>
                    <TableCell>
                      {new Date(lease.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(lease.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{formatCurrency(lease.rentAmount)}</TableCell>
                    <TableCell className="capitalize">
                      {lease.paymentCycle.toLowerCase()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={lease.isAutoRenew ? "default" : "secondary"}>
                        {lease.isAutoRenew ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lease.gracePeriodDays ? `${lease.gracePeriodDays} days` : "—"}
                    </TableCell>
                    <TableCell>
                      {lease.autoRenewalNoticeDays ? `${lease.autoRenewalNoticeDays} days` : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {lease.status === "ACTIVE" ? (
                        <Button
                          variant={lease.paidAt ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleTogglePaidStatus(lease)}
                          className="h-7"
                        >
                          {lease.paidAt && (
                            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="h-3 w-3 mr-1" />
                          )}
                          {lease.paidAt ? "Paid" : "Mark as Paid"}
                        </Button>
                      ) : (
                        <span className="text-sm">
                          {lease.paidAt ? "Paid" : "Unpaid"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      {lease.status.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(lease)}
                          disabled={lease.status === "ENDED"}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDeleteDialog(lease)}
                          disabled={lease.status !== "DRAFT"}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog - Part 1 will continue in next message due to length */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLease ? "Edit Lease Agreement" : "Add New Lease Agreement"}
            </DialogTitle>
            <DialogDescription>
              {editingLease
                ? "Update the lease agreement details below"
                : "Enter the details for your new lease agreement"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {!editingLease && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tenant">Tenant *</Label>
                  <Select
                    value={formData.tenantId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tenantId: value })
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger id="tenant" className="w-full">
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.fullName} ({tenant.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property">Property *</Label>
                  <Select
                    value={formData.propertyId}
                    onValueChange={handlePropertyChange}
                    disabled={isSaving || !formData.tenantId}
                  >
                    <SelectTrigger id="property" className="w-full">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Select
                    value={formData.unitId}
                    onValueChange={handleUnitChange}
                    disabled={isSaving || !formData.propertyId}
                  >
                    <SelectTrigger id="unit" className="w-full">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment-cycle">Payment Cycle *</Label>
                <Select
                  value={formData.paymentCycle}
                  onValueChange={(value) =>
                    handlePaymentCycleChange(value as PaymentCycle)
                  }
                  disabled={isSaving || !formData.unitId}
                >
                  <SelectTrigger id="payment-cycle" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY" disabled={!isPaymentCycleAvailable("DAILY")}>
                      Daily {!isPaymentCycleAvailable("DAILY") && "(No rate set)"}
                    </SelectItem>
                    <SelectItem value="MONTHLY" disabled={!isPaymentCycleAvailable("MONTHLY")}>
                      Monthly {!isPaymentCycleAvailable("MONTHLY") && "(No rate set)"}
                    </SelectItem>
                    <SelectItem value="ANNUAL" disabled={!isPaymentCycleAvailable("ANNUAL")}>
                      Annual {!isPaymentCycleAvailable("ANNUAL") && "(No rate set)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  disabled={isSaving || !formData.unitId}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date *</Label>
              <Input
                id="end-date"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                disabled={isSaving || !formData.unitId}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto-renew"
                checked={formData.isAutoRenew}
                onChange={(e) =>
                  setFormData({ ...formData, isAutoRenew: e.target.checked })
                }
                disabled={isSaving}
                className="rounded"
              />
              <Label htmlFor="auto-renew" className="font-normal">
                Enable auto-renewal
              </Label>
            </div>
            {formData.isAutoRenew && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="auto-renewal-notice">Auto-Renewal Notice Period</Label>
                  <Input
                    id="auto-renewal-notice"
                    type="number"
                    min="1"
                    value={formData.autoRenewalNoticeDays}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        autoRenewalNoticeDays: parseInt(e.target.value) || 5,
                      })
                    }
                    disabled={isSaving || !formData.unitId}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grace-period">Grace Period</Label>
                  <Input
                    id="grace-period"
                    type="number"
                    min="0"
                    value={formData.gracePeriodDays}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        gracePeriodDays: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={isSaving || !formData.unitId}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rent-amount">Rent Amount *</Label>
                <Input
                  id="rent-amount"
                  type="text"
                  value={formData.rentAmount}
                  onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })}
                  placeholder="0"
                  disabled={isSaving || !formData.unitId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Deposit Amount</Label>
                <Input
                  id="deposit-amount"
                  type="text"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                  placeholder="0"
                  disabled={isSaving || !formData.unitId}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={handleCloseDialog}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveLease} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingLease
                ? "Update Lease"
                : "Create Lease"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the lease agreement for "{deletingLease?.tenant.fullName}".
              This action cannot be undone. Only draft leases can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLease}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? "Deleting..." : "Delete Lease"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Confirmation Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle></DialogTitle>
            <DialogDescription>
            </DialogDescription>
          </DialogHeader>
          {createdLease && (
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tenant</p>
                  <p className="text-base font-semibold">{createdLease.tenant.fullName}</p>
                  <p className="text-sm text-muted-foreground">{createdLease.tenant.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Property / Unit</p>
                  <p className="text-base font-semibold">
                    {createdLease.unit.property.name} - {createdLease.unit.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                    <p className="text-base">{formatDateForDisplay(createdLease.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">End Date</p>
                    <p className="text-base">{formatDateForDisplay(createdLease.endDate)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Payment Cycle</p>
                    <p className="text-base capitalize">{createdLease.paymentCycle.toLowerCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rent Amount</p>
                    <p className="text-base font-semibold">{formatCurrency(createdLease.rentAmount)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Auto-Renewal</p>
                  <p className="text-base">{createdLease.isAutoRenew ? "Enabled" : "Disabled"}</p>
                </div>
                {createdLease.isAutoRenew && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Notice Period</p>
                        <p className="text-base">{createdLease.autoRenewalNoticeDays} days</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Grace Period</p>
                        <p className="text-base">{createdLease.gracePeriodDays} days</p>
                      </div>
                    </div>
                    {createdLease.autoRenewalNoticeDays && (
                      <div className="pt-2 border-t">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Last Cancellation Day</p>
                            <p className="text-lg font-bold text-primary">
                              {(() => {
                                const cancelDate = new Date(createdLease.endDate)
                                cancelDate.setDate(cancelDate.getDate() - createdLease.autoRenewalNoticeDays)
                                return formatDateForDisplay(cancelDate.toISOString().split('T')[0])
                              })()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Cancel auto-renewal by this date
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Last Payment Day</p>
                            <p className="text-lg font-bold text-primary">
                              {(() => {
                                const paymentDate = new Date(createdLease.endDate)
                                paymentDate.setDate(paymentDate.getDate() + createdLease.gracePeriodDays)
                                return formatDateForDisplay(paymentDate.toISOString().split('T')[0])
                              })()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Final payment due by this date
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
          )}
          <DialogFooter>
            <Button onClick={() => setIsSuccessDialogOpen(false)} className="w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
