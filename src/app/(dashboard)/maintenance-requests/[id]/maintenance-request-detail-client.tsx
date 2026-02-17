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
  Layers01Icon,
} from "@hugeicons/core-free-icons";
import { formatDate } from "@/lib/format";

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

export default function MaintenanceRequestDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              <CardDescription className="mt-2">
                Created {formatDate(request.createdAt)}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {getPriorityBadge(request.priority)}
              {getStatusBadge(request.status)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            <p className="text-muted-foreground whitespace-pre-wrap">{request.description}</p>
          </div>
        </CardContent>
      </Card>

      {/* Info Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Property/Unit */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HugeiconsIcon icon={Home01Icon} size={16} />
              Property & Unit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Link
                href={`/properties/${request.property.id}`}
                className="font-medium hover:underline"
              >
                {request.property.name}
              </Link>
              {request.unit && (
                <p className="text-sm text-muted-foreground">{request.unit.name}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cost */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cost Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Estimated</p>
                <p className="font-medium">
                  {request.estimatedCost
                    ? `Rp ${Number(request.estimatedCost).toLocaleString()}`
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actual</p>
                <p className="font-medium">
                  {request.actualCost
                    ? `Rp ${Number(request.actualCost).toLocaleString()}`
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenant */}
        {request.tenant && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tenant</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/tenants/${request.tenant.id}`}
                className="font-medium hover:underline"
              >
                {request.tenant.fullName}
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Completion */}
        {request.completedAt && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {formatDate(request.completedAt)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Recent updates and changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {request.activities.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity yet</p>
            ) : (
              request.activities.map((activity) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <HugeiconsIcon icon={ToolsIcon} size={14} />
                    </div>
                    <div className="w-px flex-1 bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {activity.user?.name || "System"} •{" "}
                      {new Date(activity.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
