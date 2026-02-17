"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  ArrowLeft01Icon,
  Home01Icon,
} from "@hugeicons/core-free-icons"

type Property = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  _count: {
    units: number
  }
}

type Unit = {
  id: string
  name: string
  dailyRate: string
  monthlyRate: string
  annualRate: string | null
  isUnavailable: boolean
  createdAt: string
  updatedAt: string
}

export default function PropertyDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [propertyId, setPropertyId] = useState<string>("")

  const [formData, setFormData] = useState({
    name: "",
    dailyRate: "",
    monthlyRate: "",
    annualRate: "",
    isUnavailable: false,
  })

  useEffect(() => {
    Promise.resolve(params).then((resolvedParams) => {
      setPropertyId(resolvedParams.id)
    })
  }, [params])

  useEffect(() => {
    if (propertyId) {
      fetchProperty()
      fetchUnits()
    }
  }, [propertyId])

  const fetchProperty = async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch property")
      }

      const data = await response.json()
      setProperty(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load property")
    }
  }

  const fetchUnits = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/properties/${propertyId}/units`)

      if (!response.ok) {
        throw new Error("Failed to fetch units")
      }

      const data = await response.json()
      setUnits(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load units")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit)
      setFormData({
        name: unit.name,
        dailyRate: unit.dailyRate.toString(),
        monthlyRate: unit.monthlyRate.toString(),
        annualRate: unit.annualRate?.toString() || "",
        isUnavailable: unit.isUnavailable,
      })
    } else {
      setEditingUnit(null)
      setFormData({
        name: "",
        dailyRate: "",
        monthlyRate: "",
        annualRate: "",
        isUnavailable: false,
      })
    }
    setError(null)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingUnit(null)
    setFormData({
      name: "",
      dailyRate: "",
      monthlyRate: "",
      annualRate: "",
      isUnavailable: false,
    })
    setError(null)
  }

  const handleSaveUnit = async () => {
    if (!formData.name.trim()) {
      setError("Unit name is required")
      return
    }

    const dailyRate = formData.dailyRate ? parseFloat(formData.dailyRate) : null
    const monthlyRate = formData.monthlyRate ? parseFloat(formData.monthlyRate) : null
    const annualRate = formData.annualRate ? parseFloat(formData.annualRate) : null

    // At least one rate must be provided
    if (dailyRate === null && monthlyRate === null && annualRate === null) {
      setError("At least one rate (daily, monthly, or annual) must be provided")
      return
    }

    if (dailyRate !== null && (isNaN(dailyRate) || dailyRate < 0)) {
      setError("Daily rate must be a positive number")
      return
    }

    if (monthlyRate !== null && (isNaN(monthlyRate) || monthlyRate < 0)) {
      setError("Monthly rate must be a positive number")
      return
    }

    if (annualRate !== null && (isNaN(annualRate) || annualRate < 0)) {
      setError("Annual rate must be a positive number")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const url = editingUnit
        ? `/api/units/${editingUnit.id}`
        : `/api/properties/${propertyId}/units`

      const method = editingUnit ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          dailyRate,
          monthlyRate,
          annualRate,
          isUnavailable: formData.isUnavailable,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save unit")
      }

      await fetchUnits()
      await fetchProperty()
      handleCloseDialog()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save unit")
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenDeleteDialog = (unit: Unit) => {
    setDeletingUnit(unit)
    setIsDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false)
    setDeletingUnit(null)
  }

  const handleDeleteUnit = async () => {
    if (!deletingUnit) return

    setIsSaving(true)

    try {
      const response = await fetch(`/api/units/${deletingUnit.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete unit")
      }

      await fetchUnits()
      await fetchProperty()
      handleCloseDeleteDialog()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete unit")
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (value: string | number | null) => {
    if (value === null || value === "") return "—"
    const num = typeof value === "string" ? parseFloat(value) : value
    if (isNaN(num)) return "—"
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  if (!property && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Property not found</h2>
          <p className="text-muted-foreground mb-6">
            The property you're looking for doesn't exist
          </p>
          <Button asChild>
            <Link href="/properties">
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="inline-start" />
              Back to Properties
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
          <Link href="/properties">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{property?.name || "Loading..."}</h1>
          <p className="text-muted-foreground mt-1">
            Manage units and rental rates
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
          Add Unit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
          <CardDescription>
            All rental units in this property
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading units...
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-12">
              <HugeiconsIcon
                icon={Home01Icon}
                strokeWidth={1.5}
                className="mx-auto h-12 w-12 text-muted-foreground mb-4"
              />
              <h3 className="text-lg font-medium mb-2">No units yet</h3>
              <p className="text-muted-foreground mb-6">
                Get started by creating your first unit
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
                Add Unit
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Daily Rate</TableHead>
                  <TableHead>Monthly Rate</TableHead>
                  <TableHead>Annual Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id} className={unit.isUnavailable ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {unit.name}
                      {unit.isUnavailable && (
                        <span className="ml-2 text-xs text-muted-foreground">(Unavailable)</span>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(unit.dailyRate)}</TableCell>
                    <TableCell>{formatCurrency(unit.monthlyRate)}</TableCell>
                    <TableCell>
                      {unit.annualRate ? formatCurrency(unit.annualRate) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(unit)}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDeleteDialog(unit)}
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
              {editingUnit ? "Edit Unit" : "Add New Unit"}
            </DialogTitle>
            <DialogDescription>
              {editingUnit
                ? "Update the unit details below"
                : "Enter the details for your new unit"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="unit-name">Unit Name *</Label>
              <Input
                id="unit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Unit 101, Room A"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-rate">Daily Rate</Label>
              <Input
                id="daily-rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.dailyRate}
                onChange={(e) =>
                  setFormData({ ...formData, dailyRate: e.target.value })
                }
                placeholder="0.00"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly-rate">Monthly Rate</Label>
              <Input
                id="monthly-rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.monthlyRate}
                onChange={(e) =>
                  setFormData({ ...formData, monthlyRate: e.target.value })
                }
                placeholder="0.00"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual-rate">Annual Rate</Label>
              <Input
                id="annual-rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.annualRate}
                onChange={(e) =>
                  setFormData({ ...formData, annualRate: e.target.value })
                }
                placeholder="0.00"
                disabled={isSaving}
              />
            </div>
            <div className="flex items-center justify-between space-x-2 pt-2">
              <Label htmlFor="is-unavailable" className="flex flex-col space-y-1">
                <span>Mark as Unavailable</span>
                <span className="font-normal text-sm text-muted-foreground">
                  This unit will not be available for new leases
                </span>
              </Label>
              <Switch
                id="is-unavailable"
                checked={formData.isUnavailable}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isUnavailable: checked })
                }
                disabled={isSaving}
              />
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
            <Button onClick={handleSaveUnit} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingUnit
                ? "Update Unit"
                : "Create Unit"}
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
              This will permanently delete the unit "{deletingUnit?.name}" and all
              associated lease agreements. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUnit}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? "Deleting..." : "Delete Unit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
