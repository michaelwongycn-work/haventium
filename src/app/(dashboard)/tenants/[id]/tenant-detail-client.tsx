"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentList } from "@/components/document-list";
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
  Mail01Icon,
  SmartPhone01Icon,
  CheckmarkCircle02Icon,
  File01Icon,
  Cancel01Icon,
  UserIcon,
  Home01Icon,
  Layers01Icon,
  CreditCardIcon,
  ShieldEnergyIcon,
  Notification01Icon,
  MoreHorizontalIcon,
  ToolsIcon,
  PencilEdit02Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { formatDate, formatCurrency } from "@/lib/format";

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

type TenantStatus = "LEAD" | "BOOKED" | "ACTIVE" | "EXPIRED";

type Tenant = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: TenantStatus;
  preferEmail: boolean;
  preferWhatsapp: boolean;
  preferTelegram: boolean;
  createdAt: string;
  updatedAt: string;
  leaseAgreements: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    rentAmount: string;
    unit: {
      name: string;
      property: {
        name: string;
      };
    };
  }>;
  maintenanceRequests: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    createdAt: string;
    completedAt: string | null;
    property: {
      id: string;
      name: string;
    };
    unit: {
      id: string;
      name: string;
    } | null;
  }>;
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

export default function TenantDetailClient({
  params,
}: {
  params: { id: string };
}) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>("");

  useEffect(() => {
    Promise.resolve(params).then((resolvedParams) => {
      setTenantId(resolvedParams.id);
    });
  }, [params]);

  useEffect(() => {
    if (tenantId) {
      fetchTenant();
    }
  }, [tenantId]);

  const fetchTenant = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/tenants/${tenantId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch tenant");
      }

      const data = await response.json();
      setTenant(data);
    } catch (err) {
      // Error handled via UI state
    } finally {
      setIsLoading(false);
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
    return formatDate(dateString);
  };

  if (!tenant && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Tenant not found</h2>
          <p className="text-muted-foreground mb-6">
            {"The tenant you're looking for doesn't exist"}
          </p>
          <Button asChild>
            <Link href="/tenants">
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Back to Tenants
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
          <Link href="/tenants">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {tenant?.fullName || "Loading..."}
          </h1>
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
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    strokeWidth={2}
                    className="h-5 w-5 text-muted-foreground"
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{tenant?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <HugeiconsIcon
                    icon={SmartPhone01Icon}
                    strokeWidth={2}
                    className="h-5 w-5 text-muted-foreground"
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{tenant?.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      WhatsApp & Telegram
                    </p>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3">
                  Preferred Communication Channel
                </p>
                <div className="space-y-2 text-sm">
                  {tenant?.preferEmail && tenant?.email && (
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        strokeWidth={2}
                        className="h-4 w-4 text-green-500"
                      />
                      <span>Email</span>
                    </div>
                  )}
                  {tenant?.preferWhatsapp && tenant?.phone && (
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        strokeWidth={2}
                        className="h-4 w-4 text-green-500"
                      />
                      <span>WhatsApp</span>
                    </div>
                  )}
                  {tenant?.preferTelegram && tenant?.phone && (
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        strokeWidth={2}
                        className="h-4 w-4 text-green-500"
                      />
                      <span>Telegram</span>
                    </div>
                  )}
                  {!tenant?.preferEmail &&
                    !tenant?.preferWhatsapp &&
                    !tenant?.preferTelegram && (
                      <p className="text-muted-foreground">
                        No preferred channel selected
                      </p>
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
              {!tenant?.leaseAgreements ||
              tenant.leaseAgreements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No lease agreements yet
                </div>
              ) : (
                <div className="space-y-3">
                  {tenant.leaseAgreements.map((lease) => (
                    <Link
                      key={lease.id}
                      href={`/leases/${lease.id}`}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="font-medium">
                          {lease.unit.property.name} - {lease.unit.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(lease.startDate)} -{" "}
                          {formatDate(lease.endDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(lease.rentAmount)}
                        </p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {lease.status.toLowerCase()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Requests</CardTitle>
              <CardDescription>
                All maintenance requests for this tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!tenant?.maintenanceRequests ||
              tenant.maintenanceRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No maintenance requests yet
                </div>
              ) : (
                <div className="space-y-3">
                  {tenant.maintenanceRequests.map((request) => (
                    <Link
                      key={request.id}
                      href={`/maintenance-requests/${request.id}`}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{request.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.property.name}
                          {request.unit && ` - ${request.unit.name}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(request.createdAt)}
                          {request.completedAt &&
                            ` - Completed ${formatDate(request.completedAt)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(request.priority)}
                        {getStatusBadge(request.status)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardContent className="pt-6">
              <DocumentList entityType="tenant" entityId={params.id} />
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent activity for this tenant</CardDescription>
            </CardHeader>
            <CardContent>
              {!tenant?.activities || tenant.activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No activity yet
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-0">
                    {tenant.activities.map((activity) => {
                      const IconComponent =
                        ACTIVITY_ICON_MAP[activity.type] || MoreHorizontalIcon;
                      const colorClass =
                        ACTIVITY_COLOR_MAP[activity.type] ||
                        "text-muted-foreground";
                      const bgClass =
                        ACTIVITY_BG_MAP[activity.type] || "bg-muted";

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
        </>
      )}
    </div>
  );
}
