"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { hasAccess, type UserRole } from "@/lib/access-utils";
import { DocumentList } from "@/components/document-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  ArrowLeft01Icon,
  Home01Icon,
  File01Icon,
  Cancel01Icon,
  UserIcon,
  Layers01Icon,
  CreditCardIcon,
  ShieldEnergyIcon,
  Notification01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";

const ACTIVITY_ICON_MAP: Record<string, typeof File01Icon> = {
  LEASE_CREATED: File01Icon,
  LEASE_UPDATED: File01Icon,
  LEASE_TERMINATED: Cancel01Icon,
  TENANT_CREATED: UserIcon,
  TENANT_UPDATED: UserIcon,
  TENANT_STATUS_CHANGED: UserIcon,
  PROPERTY_CREATED: Home01Icon,
  PROPERTY_UPDATED: Home01Icon,
  UNIT_CREATED: Layers01Icon,
  UNIT_UPDATED: Layers01Icon,
  PAYMENT_RECORDED: CreditCardIcon,
  PAYMENT_UPDATED: CreditCardIcon,
  DEPOSIT_CREATED: ShieldEnergyIcon,
  DEPOSIT_RETURNED: ShieldEnergyIcon,
  NOTIFICATION_SENT: Notification01Icon,
  USER_LOGIN: UserIcon,
  OTHER: MoreHorizontalIcon,
};

const ACTIVITY_COLOR_MAP: Record<string, string> = {
  LEASE_CREATED: "text-blue-500",
  LEASE_UPDATED: "text-blue-500",
  LEASE_TERMINATED: "text-blue-500",
  TENANT_CREATED: "text-violet-500",
  TENANT_UPDATED: "text-violet-500",
  TENANT_STATUS_CHANGED: "text-violet-500",
  PROPERTY_CREATED: "text-emerald-500",
  PROPERTY_UPDATED: "text-emerald-500",
  UNIT_CREATED: "text-emerald-500",
  UNIT_UPDATED: "text-emerald-500",
  PAYMENT_RECORDED: "text-amber-500",
  PAYMENT_UPDATED: "text-amber-500",
  DEPOSIT_CREATED: "text-amber-500",
  DEPOSIT_RETURNED: "text-amber-500",
  NOTIFICATION_SENT: "text-blue-500",
  USER_LOGIN: "text-violet-500",
  OTHER: "text-muted-foreground",
};

const ACTIVITY_BG_MAP: Record<string, string> = {
  LEASE_CREATED: "bg-blue-500/10",
  LEASE_UPDATED: "bg-blue-500/10",
  LEASE_TERMINATED: "bg-blue-500/10",
  TENANT_CREATED: "bg-violet-500/10",
  TENANT_UPDATED: "bg-violet-500/10",
  TENANT_STATUS_CHANGED: "bg-violet-500/10",
  PROPERTY_CREATED: "bg-emerald-500/10",
  PROPERTY_UPDATED: "bg-emerald-500/10",
  UNIT_CREATED: "bg-emerald-500/10",
  UNIT_UPDATED: "bg-emerald-500/10",
  PAYMENT_RECORDED: "bg-amber-500/10",
  PAYMENT_UPDATED: "bg-amber-500/10",
  DEPOSIT_CREATED: "bg-amber-500/10",
  DEPOSIT_RETURNED: "bg-amber-500/10",
  NOTIFICATION_SENT: "bg-blue-500/10",
  USER_LOGIN: "bg-violet-500/10",
  OTHER: "bg-muted",
};

type Property = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    units: number;
  };
  activities: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
    user: {
      name: string;
      email: string;
    } | null;
  }>;
};

type Unit = {
  id: string;
  name: string;
  dailyRate: string;
  monthlyRate: string;
  annualRate: string | null;
  isUnavailable: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function PropertyDetailClient({
  params,
  roles,
}: {
  params: { id: string };
  roles: UserRole[];
}) {
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [propertyId, setPropertyId] = useState<string>("");

  const [formData, setFormData] = useState({
    name: "",
    dailyRate: "",
    monthlyRate: "",
    annualRate: "",
    isUnavailable: false,
  });

  useEffect(() => {
    Promise.resolve(params).then((resolvedParams) => {
      setPropertyId(resolvedParams.id);
    });
  }, [params]);

  useEffect(() => {
    if (propertyId) {
      fetchProperty();
      fetchUnits();
    }
  }, [propertyId]);

  const fetchProperty = async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch property");
      }

      const data = await response.json();
      setProperty(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load property");
    }
  };

  const fetchUnits = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/properties/${propertyId}/units`);

      if (!response.ok) {
        throw new Error("Failed to fetch units");
      }

      const data = await response.json();
      setUnits(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load units");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit);
      setFormData({
        name: unit.name,
        dailyRate: unit.dailyRate?.toString() || "",
        monthlyRate: unit.monthlyRate?.toString() || "",
        annualRate: unit.annualRate?.toString() || "",
        isUnavailable: unit.isUnavailable,
      });
    } else {
      setEditingUnit(null);
      setFormData({
        name: "",
        dailyRate: "",
        monthlyRate: "",
        annualRate: "",
        isUnavailable: false,
      });
    }
    setError(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUnit(null);
    setFormData({
      name: "",
      dailyRate: "",
      monthlyRate: "",
      annualRate: "",
      isUnavailable: false,
    });
    setError(null);
  };

  const handleSaveUnit = async () => {
    if (!formData.name.trim()) {
      setError("Unit name is required");
      return;
    }

    const dailyRate = formData.dailyRate
      ? parseFloat(formData.dailyRate)
      : null;
    const monthlyRate = formData.monthlyRate
      ? parseFloat(formData.monthlyRate)
      : null;
    const annualRate = formData.annualRate
      ? parseFloat(formData.annualRate)
      : null;

    // At least one rate must be provided
    if (dailyRate === null && monthlyRate === null && annualRate === null) {
      setError(
        "At least one rate (daily, monthly, or annual) must be provided",
      );
      return;
    }

    if (dailyRate !== null && (isNaN(dailyRate) || dailyRate < 0)) {
      setError("Daily rate must be a positive number");
      return;
    }

    if (monthlyRate !== null && (isNaN(monthlyRate) || monthlyRate < 0)) {
      setError("Monthly rate must be a positive number");
      return;
    }

    if (annualRate !== null && (isNaN(annualRate) || annualRate < 0)) {
      setError("Annual rate must be a positive number");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingUnit
        ? `/api/units/${editingUnit.id}`
        : `/api/properties/${propertyId}/units`;

      const method = editingUnit ? "PATCH" : "POST";

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
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save unit");
      }

      await fetchUnits();
      await fetchProperty();
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save unit");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteDialog = (unit: Unit) => {
    setDeletingUnit(unit);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingUnit(null);
  };

  const handleDeleteUnit = async () => {
    if (!deletingUnit) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/units/${deletingUnit.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete unit");
      }

      await fetchUnits();
      await fetchProperty();
      handleCloseDeleteDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete unit");
    } finally {
      setIsSaving(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (value: string | number | null) => {
    if (value === null || value === "") return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  if (!property && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Property not found</h2>
          <p className="text-muted-foreground mb-6">
            {"The property you're looking for doesn't exist"}
          </p>
          <Button asChild>
            <Link href="/properties">
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Back to Properties
            </Link>
          </Button>
        </div>
      </div>
    );
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
          <h1 className="text-3xl font-bold">
            {property?.name || "Loading..."}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage units and rental rates
          </p>
        </div>
        {hasAccess(roles, "properties", "create") && (
          <Button onClick={() => handleOpenDialog()}>
            <HugeiconsIcon
              icon={PlusSignIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Add Unit
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
          <CardDescription>All rental units in this property</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit Name</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-[150px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[60px]" />
                    </TableCell>
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
              {hasAccess(roles, "properties", "create") && (
                <Button onClick={() => handleOpenDialog()}>
                  <HugeiconsIcon
                    icon={PlusSignIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Add Unit
                </Button>
              )}
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
                  <TableRow
                    key={unit.id}
                    className={unit.isUnavailable ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      {unit.name}
                      {unit.isUnavailable && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Unavailable)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(unit.dailyRate)}</TableCell>
                    <TableCell>{formatCurrency(unit.monthlyRate)}</TableCell>
                    <TableCell>
                      {unit.annualRate ? formatCurrency(unit.annualRate) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {hasAccess(roles, "properties", "update") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(unit)}
                          >
                            <HugeiconsIcon
                              icon={PencilEdit02Icon}
                              strokeWidth={2}
                              className="h-4 w-4"
                            />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                        {hasAccess(roles, "properties", "delete") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDeleteDialog(unit)}
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              strokeWidth={2}
                              className="h-4 w-4"
                            />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardContent className="pt-6">
          <DocumentList entityType="property" entityId={params.id} />
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Recent activity for this property</CardDescription>
        </CardHeader>
        <CardContent>
          {!property?.activities || property.activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity yet
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border" />
              <div className="space-y-0">
                {property.activities.map((activity) => {
                  const IconComponent =
                    ACTIVITY_ICON_MAP[activity.type] || MoreHorizontalIcon;
                  const colorClass =
                    ACTIVITY_COLOR_MAP[activity.type] ||
                    "text-muted-foreground";
                  const bgClass = ACTIVITY_BG_MAP[activity.type] || "bg-muted";

                  return (
                    <div
                      key={activity.id}
                      className="relative flex gap-3 pb-6 last:pb-0"
                    >
                      <div
                        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bgClass}`}
                      >
                        <HugeiconsIcon
                          icon={IconComponent}
                          strokeWidth={2}
                          className={`h-4 w-4 ${colorClass}`}
                        />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm leading-relaxed">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(activity.createdAt)}
                          </p>
                          {activity.user && (
                            <p className="text-xs text-muted-foreground">
                              by{" "}
                              <span className="font-medium">
                                {activity.user.name}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
              <Label
                htmlFor="is-unavailable"
                className="flex flex-col space-y-1"
              >
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
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {"This will permanently delete the unit '"}
              {deletingUnit?.name}
              {"' and all"}
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
  );
}
