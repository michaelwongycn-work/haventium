"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ToolsIcon,
  Home01Icon,
  UserIcon,
  File01Icon,
  PencilEdit02Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { formatDate, formatCurrency } from "@/lib/format";
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
import { hasAccess, type UserRole } from "@/lib/access-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MaintenanceRequest = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  estimatedCost: number | null;
  actualCost: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    name: string;
  };
  unit: {
    id: string;
    name: string;
  } | null;
  tenant: {
    id: string;
    fullName: string;
  } | null;
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

const STATUS_ICON_MAP: Record<string, typeof File01Icon> = {
  OPEN: File01Icon,
  IN_PROGRESS: PencilEdit02Icon,
  COMPLETED: CheckmarkCircle01Icon,
  CANCELLED: File01Icon,
};

const STATUS_COLOR_MAP: Record<string, string> = {
  OPEN: "text-blue-500",
  IN_PROGRESS: "text-amber-500",
  COMPLETED: "text-green-500",
  CANCELLED: "text-red-500",
};

const STATUS_BG_MAP: Record<string, string> = {
  OPEN: "bg-blue-500/10",
  IN_PROGRESS: "bg-amber-500/10",
  COMPLETED: "bg-green-500/10",
  CANCELLED: "bg-red-500/10",
};

const ACTIVITY_ICON_MAP: Record<string, typeof File01Icon> = {
  MAINTENANCE_REQUEST_CREATED: ToolsIcon,
  MAINTENANCE_REQUEST_UPDATED: ToolsIcon,
  MAINTENANCE_REQUEST_STATUS_CHANGED: ToolsIcon,
  MAINTENANCE_REQUEST_COMPLETED: CheckmarkCircle01Icon,
  OTHER: File01Icon,
};

const ACTIVITY_COLOR_MAP: Record<string, string> = {
  MAINTENANCE_REQUEST_CREATED: "text-blue-500",
  MAINTENANCE_REQUEST_UPDATED: "text-amber-500",
  MAINTENANCE_REQUEST_STATUS_CHANGED: "text-violet-500",
  MAINTENANCE_REQUEST_COMPLETED: "text-green-500",
  OTHER: "text-muted-foreground",
};

const ACTIVITY_BG_MAP: Record<string, string> = {
  MAINTENANCE_REQUEST_CREATED: "bg-blue-500/10",
  MAINTENANCE_REQUEST_UPDATED: "bg-amber-500/10",
  MAINTENANCE_REQUEST_STATUS_CHANGED: "bg-violet-500/10",
  MAINTENANCE_REQUEST_COMPLETED: "bg-green-500/10",
  OTHER: "bg-muted",
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    OPEN: "default",
    IN_PROGRESS: "secondary",
    COMPLETED: "outline",
    CANCELLED: "destructive",
  };

  return (
    <Badge variant={variants[status] || "default"}>
      {status.replace("_", " ")}
    </Badge>
  );
};

const getPriorityBadge = (priority: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    LOW: "outline",
    MEDIUM: "secondary",
    HIGH: "default",
    URGENT: "destructive",
  };

  return <Badge variant={variants[priority] || "default"}>{priority}</Badge>;
};

export default function MaintenanceRequestDetailClient({
  id,
  roles
}: {
  id: string;
  roles: UserRole[];
}) {
  const router = useRouter();
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    status: string;
    label: string;
    message: string;
    requiresCost?: boolean;
  } | null>(null);
  const [actualCost, setActualCost] = useState<string>("");

  useEffect(() => {
    fetchRequest();
  }, [id]);

  const fetchRequest = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/maintenance-requests/${id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch maintenance request");
      }

      const data = await response.json();
      setRequest(data.data || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request");
    } finally {
      setIsLoading(false);
    }
  };

  const openConfirmDialog = (status: string, label: string, message: string, requiresCost = false) => {
    setConfirmAction({ status, label, message, requiresCost });
    setActualCost(request?.actualCost?.toString() || request?.estimatedCost?.toString() || "");
    setIsConfirmDialogOpen(true);
  };

  const handleStatusChange = async (newStatus: string) => {
    // Validate actual cost for completion
    if (newStatus === 'COMPLETED') {
      const cost = parseFloat(actualCost);
      if (!actualCost || isNaN(cost) || cost < 0) {
        setError('Please enter a valid actual cost to complete the request');
        return;
      }
    }

    setIsStatusChanging(true);
    setError(null);
    try {
      const body: { status: string; actualCost?: number } = { status: newStatus };

      // Include actual cost for completion
      if (newStatus === 'COMPLETED') {
        body.actualCost = parseFloat(actualCost);
      }

      const response = await fetch(`/api/maintenance-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      await fetchRequest(); // Refetch to update UI
      setIsConfirmDialogOpen(false);
      setConfirmAction(null);
      setActualCost("");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsStatusChanging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error || "Request not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="mr-2" />
          Back
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{request.title}</CardTitle>
              <CardDescription className="mt-2 whitespace-pre-wrap">
                {request.description}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {getPriorityBadge(request.priority)}
              {getStatusBadge(request.status)}
            </div>
          </div>

          {/* Status Transition Actions */}
          {hasAccess(roles, 'maintenance', 'update') && (
            <div className="flex gap-2 mt-4">
              {request.status === 'OPEN' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    disabled={isStatusChanging}
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} size={16} className="mr-2" />
                    {isStatusChanging ? 'Updating...' : 'Start Work'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => openConfirmDialog(
                      'CANCELLED',
                      'Cancel Request',
                      'Are you sure you want to cancel this maintenance request? This action cannot be undone.'
                    )}
                    disabled={isStatusChanging}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-2" />
                    Cancel
                  </Button>
                </>
              )}

              {request.status === 'IN_PROGRESS' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => openConfirmDialog(
                      'COMPLETED',
                      'Mark Complete',
                      'Please enter the actual cost incurred for this maintenance work. This will mark the request as completed and cannot be undone.',
                      true
                    )}
                    disabled={isStatusChanging}
                  >
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} className="mr-2" />
                    {isStatusChanging ? 'Updating...' : 'Mark Complete'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => openConfirmDialog(
                      'CANCELLED',
                      'Cancel Request',
                      'Are you sure you want to cancel this maintenance request? This action cannot be undone.'
                    )}
                    disabled={isStatusChanging}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-2" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Location & Tenant */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HugeiconsIcon icon={Home01Icon} size={16} />
            Location & Tenant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Property</p>
              <Link
                href={`/properties/${request.property.id}`}
                className="font-medium hover:underline text-sm"
              >
                {request.property.name}
              </Link>
            </div>
            {request.unit && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Unit</p>
                <Link
                  href={`/properties/${request.property.id}/units/${request.unit.id}`}
                  className="font-medium hover:underline text-sm"
                >
                  {request.unit.name}
                </Link>
              </div>
            )}
            {request.tenant && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tenant</p>
                <Link
                  href={`/tenants/${request.tenant.id}`}
                  className="font-medium hover:underline text-sm"
                >
                  {request.tenant.fullName}
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Tracking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Cost Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Estimated Cost</p>
              <p className="font-medium">
                {request.estimatedCost ? formatCurrency(request.estimatedCost) : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Actual Cost</p>
              <p className="font-medium">
                {request.actualCost ? formatCurrency(request.actualCost) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Progress Timeline</CardTitle>
          <CardDescription>Status updates and maintenance history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-4">
            {/* Vertical line */}
            <div className="absolute left-[17px] top-2 bottom-2 w-[2px] bg-border" />

            {/* Created */}
            <div className="relative flex gap-4">
              <div className="relative z-10">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
                  <HugeiconsIcon
                    icon={File01Icon}
                    strokeWidth={2}
                    className="h-4 w-4 text-blue-500"
                  />
                </div>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm font-medium">Request Created</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(request.createdAt)} • {new Date(request.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* In Progress (if status is IN_PROGRESS, COMPLETED, or CANCELLED) */}
            {(request.status === "IN_PROGRESS" || request.status === "COMPLETED" || request.status === "CANCELLED") && (
              <div className="relative flex gap-4">
                <div className="relative z-10">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
                    <HugeiconsIcon
                      icon={PencilEdit02Icon}
                      strokeWidth={2}
                      className="h-4 w-4 text-amber-500"
                    />
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium">Work In Progress</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Maintenance work started
                  </p>
                </div>
              </div>
            )}

            {/* Completed or Cancelled */}
            {request.status === "COMPLETED" && (
              <div className="relative flex gap-4">
                <div className="relative z-10">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10">
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      strokeWidth={2}
                      className="h-4 w-4 text-green-500"
                    />
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium">Request Completed</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {request.completedAt ? `${formatDate(request.completedAt)} • ${new Date(request.completedAt).toLocaleTimeString()}` : "Maintenance work completed"}
                  </p>
                </div>
              </div>
            )}

            {request.status === "CANCELLED" && (
              <div className="relative flex gap-4">
                <div className="relative z-10">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
                    <HugeiconsIcon
                      icon={File01Icon}
                      strokeWidth={2}
                      className="h-4 w-4 text-red-500"
                    />
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium">Request Cancelled</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Maintenance request was cancelled
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Confirmation Dialog */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Actual Cost Input for Completion */}
          {confirmAction?.requiresCost && (
            <div className="space-y-2 py-4">
              <Label htmlFor="actualCost">
                Actual Cost <span className="text-destructive">*</span>
              </Label>
              <Input
                id="actualCost"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter actual cost"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                disabled={isStatusChanging}
              />
              {request?.estimatedCost && (
                <p className="text-xs text-muted-foreground">
                  Estimated cost: {formatCurrency(request.estimatedCost)}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStatusChanging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && handleStatusChange(confirmAction.status)}
              disabled={isStatusChanging}
              className={confirmAction?.status === 'CANCELLED' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {isStatusChanging ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
