"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { hasAccess, type UserRole } from "@/lib/access-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
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
  CheckmarkCircle01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { formatCurrency, formatDate } from "@/lib/format";

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

const LEASE_STATUS_ICON_MAP: Record<string, typeof File01Icon> = {
  DRAFT: File01Icon,
  ACTIVE: CheckmarkCircle01Icon,
  ENDED: CheckmarkCircle01Icon,
  CANCELLED: Cancel01Icon,
};

const LEASE_STATUS_COLOR_MAP: Record<string, string> = {
  DRAFT: "text-blue-500",
  ACTIVE: "text-green-500",
  ENDED: "text-gray-500",
  CANCELLED: "text-red-500",
};

const LEASE_STATUS_BG_MAP: Record<string, string> = {
  DRAFT: "bg-blue-500/10",
  ACTIVE: "bg-green-500/10",
  ENDED: "bg-gray-500/10",
  CANCELLED: "bg-red-500/10",
};

type Unit = {
  id: string;
  name: string;
  dailyRate: string | null;
  monthlyRate: string | null;
  annualRate: string | null;
  isUnavailable: boolean;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    name: string;
  };
};

type Lease = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  rentAmount: string;
  paymentCycle: string;
  paidAt: string | null;
  tenant: {
    id: string;
    fullName: string;
  };
  renewedFrom: { id: string } | null;
  renewedTo: { id: string } | null;
};

type Activity = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  } | null;
};

type UnitData = {
  unit: Unit;
  leases: Lease[];
  activities: Activity[];
};

export default function UnitDetailClient({
  params,
  roles,
}: {
  params: { propertyId: string; unitId: string };
  roles: UserRole[];
}) {
  const router = useRouter();
  const [data, setData] = useState<UnitData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    dailyRate: "",
    monthlyRate: "",
    annualRate: "",
    isUnavailable: false,
  });

  const canUpdate = hasAccess(roles, "properties", "update");
  const canDelete = hasAccess(roles, "properties", "delete");

  useEffect(() => {
    fetchUnitData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.unitId]);

  const fetchUnitData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/units/${params.unitId}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch unit data: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching unit:", err);
      setError(err instanceof Error ? err.message : "Failed to load unit data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = () => {
    if (!data) return;
    setFormData({
      name: data.unit.name,
      dailyRate: data.unit.dailyRate || "",
      monthlyRate: data.unit.monthlyRate || "",
      annualRate: data.unit.annualRate || "",
      isUnavailable: data.unit.isUnavailable,
    });
    setError("");
    setIsEditDialogOpen(true);
  };

  const handleSaveUnit = async () => {
    try {
      setIsSaving(true);
      setError("");

      const response = await fetch(`/api/units/${params.unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          dailyRate: formData.dailyRate ? parseFloat(formData.dailyRate) : null,
          monthlyRate: formData.monthlyRate
            ? parseFloat(formData.monthlyRate)
            : null,
          annualRate: formData.annualRate
            ? parseFloat(formData.annualRate)
            : null,
          isUnavailable: formData.isUnavailable,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update unit");
      }

      setIsEditDialogOpen(false);
      fetchUnitData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update unit");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUnit = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/units/${params.unitId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete unit");
      }

      router.push(`/properties/${params.propertyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete unit");
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
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

  const getStatusBadgeVariant = (
    status: string,
  ): "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" => {
    switch (status) {
      case "DRAFT":
        return "default";
      case "ACTIVE":
        return "default";
      case "ENDED":
        return "secondary";
      case "CANCELLED":
        return "destructive";
      default:
        return "default";
    }
  };

  const getPaymentCycleBadgeVariant = (cycle: string) => {
    switch (cycle) {
      case "DAILY":
        return "outline";
      case "MONTHLY":
        return "secondary";
      case "ANNUAL":
        return "default";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {error || "Failed to load unit data"}
        </p>
        <Button
          variant="link"
          onClick={() => router.push(`/properties/${params.propertyId}`)}
        >
          Back to Property
        </Button>
      </div>
    );
  }

  const { unit, leases, activities } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/properties"
              className="hover:text-foreground transition-colors"
            >
              Properties
            </Link>
            <span>/</span>
            <Link
              href={`/properties/${params.propertyId}`}
              className="hover:text-foreground transition-colors"
            >
              {unit.property.name}
            </Link>
            <span>/</span>
            <span>Units</span>
            <span>/</span>
            <span className="text-foreground">{unit.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{unit.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/properties/${params.propertyId}`)}
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              strokeWidth={2}
              className="h-4 w-4 mr-2"
            />
            Back to Property
          </Button>
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={handleEditClick}>
              <HugeiconsIcon
                icon={PencilEdit02Icon}
                strokeWidth={2}
                className="h-4 w-4 mr-2"
              />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                strokeWidth={2}
                className="h-4 w-4 mr-2"
              />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Daily Rate</CardDescription>
            <CardTitle className="text-2xl">
              {unit.dailyRate ? formatCurrency(unit.dailyRate) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Monthly Rate</CardDescription>
            <CardTitle className="text-2xl">
              {unit.monthlyRate ? formatCurrency(unit.monthlyRate) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Annual Rate</CardDescription>
            <CardTitle className="text-2xl">
              {unit.annualRate ? formatCurrency(unit.annualRate) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Availability</CardDescription>
            <CardTitle className="text-2xl">
              <Badge variant={unit.isUnavailable ? "destructive" : "default"}>
                {unit.isUnavailable ? "Unavailable" : "Available"}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Rental History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Rental History</CardTitle>
          <CardDescription>
            Chronological history of all leases for this unit
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No rental history yet
            </div>
          ) : (
            <div className="relative space-y-4">
              {/* Vertical line */}
              <div className="absolute left-[17px] top-2 bottom-2 w-[2px] bg-border" />

              {leases.map((lease) => {
                const IconComponent =
                  LEASE_STATUS_ICON_MAP[lease.status] || File01Icon;
                const colorClass =
                  LEASE_STATUS_COLOR_MAP[lease.status] || "text-blue-500";
                const bgClass =
                  LEASE_STATUS_BG_MAP[lease.status] || "bg-blue-500/10";

                return (
                  <div key={lease.id} className="relative flex gap-4">
                    {/* Icon circle */}
                    <div className="relative z-10">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${bgClass}`}
                      >
                        <HugeiconsIcon
                          icon={IconComponent}
                          strokeWidth={2}
                          className={`h-4 w-4 ${colorClass}`}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <Link
                            href={`/tenants/${lease.tenant.id}`}
                            className="font-medium hover:underline"
                          >
                            {lease.tenant.fullName}
                          </Link>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {formatDate(lease.startDate)} -{" "}
                            {formatDate(lease.endDate)}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge
                              variant={getStatusBadgeVariant(lease.status)}
                            >
                              {lease.status}
                            </Badge>
                            <Badge
                              variant={getPaymentCycleBadgeVariant(
                                lease.paymentCycle,
                              )}
                            >
                              {lease.paymentCycle}
                            </Badge>
                            {lease.paidAt && (
                              <Badge variant="outline">Paid</Badge>
                            )}
                            {lease.renewedFrom && (
                              <Badge variant="outline">
                                <HugeiconsIcon
                                  icon={ArrowLeft01Icon}
                                  strokeWidth={2}
                                  className="h-3 w-3 mr-1"
                                />
                                Renewal
                              </Badge>
                            )}
                            {lease.renewedTo && (
                              <Badge variant="outline">
                                Renewed
                                <HugeiconsIcon
                                  icon={ArrowRight01Icon}
                                  strokeWidth={2}
                                  className="h-3 w-3 ml-1"
                                />
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(lease.rentAmount)}
                          </p>
                          <Link
                            href={`/leases/${lease.id}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Recent activity for this unit</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity yet
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border" />
              <div className="space-y-0">
                {activities.map((activity) => {
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Unit</DialogTitle>
            <DialogDescription>Update the unit details below</DialogDescription>
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
                value={formData.annualRate}
                onChange={(e) =>
                  setFormData({ ...formData, annualRate: e.target.value })
                }
                placeholder="0.00"
                disabled={isSaving}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is-unavailable">Mark as Unavailable</Label>
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
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveUnit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
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
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this unit? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUnit}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
