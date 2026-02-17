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
import { Switch } from "@/components/ui/switch"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  UserIcon,
  Search01Icon,
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
  _count: {
    leaseAgreements: number
  }
}

const statusColors: Record<TenantStatus, string> = {
  LEAD: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  BOOKED: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
  ACTIVE: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  EXPIRED: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    status: "LEAD" as TenantStatus,
    preferEmail: false,
    preferWhatsapp: false,
  })

  useEffect(() => {
    fetchTenants()
  }, [])

  useEffect(() => {
    filterTenants()
  }, [tenants, statusFilter, searchQuery])

  const fetchTenants = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/tenants")

      if (!response.ok) {
        throw new Error("Failed to fetch tenants")
      }

      const data = await response.json()
      setTenants(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants")
    } finally {
      setIsLoading(false)
    }
  }

  const filterTenants = () => {
    let filtered = tenants

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((tenant) => tenant.status === statusFilter)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (tenant) =>
          tenant.fullName.toLowerCase().includes(query) ||
          tenant.email.toLowerCase().includes(query) ||
          tenant.phone.toLowerCase().includes(query)
      )
    }

    setFilteredTenants(filtered)
  }

  const handleOpenDialog = (tenant?: Tenant) => {
    if (tenant) {
      setEditingTenant(tenant)
      setFormData({
        fullName: tenant.fullName,
        email: tenant.email,
        phone: tenant.phone,
        status: tenant.status,
        preferEmail: tenant.preferEmail,
        preferWhatsapp: tenant.preferWhatsapp,
      })
    } else {
      setEditingTenant(null)
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        status: "LEAD",
        preferEmail: false,
        preferWhatsapp: false,
      })
    }
    setError(null)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingTenant(null)
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      status: "LEAD",
      preferEmail: false,
      preferWhatsapp: false,
    })
    setError(null)
  }

  const handleSaveTenant = async () => {
    if (!formData.fullName.trim()) {
      setError("Full name is required")
      return
    }

    // At least one contact method required
    if (!formData.email.trim() && !formData.phone.trim()) {
      setError("At least one contact method (email or phone) is required")
      return
    }

    // Validate email format if provided
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        setError("Please enter a valid email address")
        return
      }
    }

    // Validate phone format if provided
    if (formData.phone.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/
      if (!phoneRegex.test(formData.phone) || formData.phone.replace(/\D/g, "").length < 8) {
        setError("Please enter a valid phone number (at least 8 digits)")
        return
      }
    }

    // Validate preferences match available contact methods
    if (formData.preferEmail && !formData.email.trim()) {
      setError("Cannot prefer email without providing an email address")
      return
    }

    if (formData.preferWhatsapp && !formData.phone.trim()) {
      setError("Cannot prefer WhatsApp without providing a phone number")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const url = editingTenant
        ? `/api/tenants/${editingTenant.id}`
        : "/api/tenants"

      const method = editingTenant ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save tenant")
      }

      await fetchTenants()
      handleCloseDialog()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tenant")
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenDeleteDialog = (tenant: Tenant) => {
    setDeletingTenant(tenant)
    setIsDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false)
    setDeletingTenant(null)
  }

  const handleDeleteTenant = async () => {
    if (!deletingTenant) return

    setIsSaving(true)

    try {
      const response = await fetch(`/api/tenants/${deletingTenant.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete tenant")
      }

      await fetchTenants()
      handleCloseDeleteDialog()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tenant")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tenants and leads
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
          Add Tenant
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Tenants</CardTitle>
              <CardDescription>
                A list of all your tenants and leads
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
                  placeholder="Search tenants..."
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
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="BOOKED">Booked</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading tenants...
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-12">
              <HugeiconsIcon
                icon={UserIcon}
                strokeWidth={1.5}
                className="mx-auto h-12 w-12 text-muted-foreground mb-4"
              />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery || statusFilter !== "all"
                  ? "No tenants found"
                  : "No tenants yet"}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first tenant"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => handleOpenDialog()}>
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
                  Add Tenant
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer"
                    onClick={() => window.location.href = `/tenants/${tenant.id}`}
                  >
                    <TableCell className="font-medium">{tenant.fullName}</TableCell>
                    <TableCell>{tenant.email || "—"}</TableCell>
                    <TableCell>{tenant.phone || "—"}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {tenant.status.toLowerCase()}
                    </TableCell>
                    <TableCell>
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(tenant)}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDeleteDialog(tenant)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTenant ? "Edit Tenant" : "Add New Tenant"}
            </DialogTitle>
            <DialogDescription>
              {editingTenant
                ? "Update the tenant details below"
                : "Enter the details for your new tenant"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name *</Label>
              <Input
                id="full-name"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                placeholder="John Doe"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 234 567 8900"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium">Preferred Communication Channel</Label>
              <p className="text-xs text-muted-foreground">
                Select how you prefer to contact this tenant
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="prefer-email" className="text-sm font-normal">
                  Prefer Email
                </Label>
                <Switch
                  id="prefer-email"
                  checked={formData.preferEmail}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, preferEmail: checked })
                  }
                  disabled={isSaving || !formData.email.trim()}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="prefer-whatsapp" className="text-sm font-normal">
                  Prefer WhatsApp
                </Label>
                <Switch
                  id="prefer-whatsapp"
                  checked={formData.preferWhatsapp}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, preferWhatsapp: checked })
                  }
                  disabled={isSaving || !formData.phone.trim()}
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
            <Button onClick={handleSaveTenant} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingTenant
                ? "Update Tenant"
                : "Create Tenant"}
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
              This will permanently delete the tenant "{deletingTenant?.fullName}" and all
              associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTenant}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? "Deleting..." : "Delete Tenant"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
