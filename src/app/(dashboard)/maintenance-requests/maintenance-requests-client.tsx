"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  Search01Icon,
  ToolsIcon,
} from "@hugeicons/core-free-icons";

type MaintenanceRequestStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type MaintenanceRequestPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type MaintenanceRequest = {
  id: string;
  title: string;
  description: string;
  status: MaintenanceRequestStatus;
  priority: MaintenanceRequestPriority;
  propertyId: string;
  unitId: string | null;
  tenantId: string | null;
  leaseId: string | null;
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
};

type Property = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  name: string;
  propertyId: string;
};

type Tenant = {
  id: string;
  fullName: string;
};

export default function MaintenanceRequestsClient() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<MaintenanceRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    propertyId: "",
    unitId: "",
    tenantId: "",
    priority: "MEDIUM" as MaintenanceRequestPriority,
    status: "OPEN" as MaintenanceRequestStatus,
    estimatedCost: "",
    actualCost: "",
  });

  useEffect(() => {
    fetchRequests();
    fetchProperties();
    fetchTenants();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, statusFilter, priorityFilter, propertyFilter, searchQuery]);

  useEffect(() => {
    if (formData.propertyId) {
      fetchUnitsForProperty(formData.propertyId);
    } else {
      setUnits([]);
    }
  }, [formData.propertyId]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/maintenance-requests");

      if (!response.ok) {
        throw new Error("Failed to fetch maintenance requests");
      }

      const data = await response.json();
      setRequests(data.data || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch("/api/properties");
      if (response.ok) {
        const data = await response.json();
        setProperties(data.data || data);
      }
    } catch (err) {
      console.error("Failed to fetch properties:", err);
    }
  };

  const fetchUnitsForProperty = async (propertyId: string) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setUnits(data.units || []);
      }
    } catch (err) {
      console.error("Failed to fetch units:", err);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await fetch("/api/tenants");
      if (response.ok) {
        const data = await response.json();
        setTenants(data.data || data);
      }
    } catch (err) {
      console.error("Failed to fetch tenants:", err);
    }
  };

  const filterRequests = () => {
    let filtered = requests;

    if (statusFilter !== "all") {
      filtered = filtered.filter((request) => request.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter((request) => request.priority === priorityFilter);
    }

    if (propertyFilter !== "all") {
      filtered = filtered.filter((request) => request.propertyId === propertyFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          request.title.toLowerCase().includes(query) ||
          request.description.toLowerCase().includes(query) ||
          request.property.name.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  };

  const handleOpenDialog = (request?: MaintenanceRequest) => {
    if (request) {
      setEditingRequest(request);
      setFormData({
        title: request.title,
        description: request.description,
        propertyId: request.propertyId,
        unitId: request.unitId || "",
        tenantId: request.tenantId || "",
        priority: request.priority,
        status: request.status,
        estimatedCost: request.estimatedCost?.toString() || "",
        actualCost: request.actualCost?.toString() || "",
      });
    } else {
      setEditingRequest(null);
      setFormData({
        title: "",
        description: "",
        propertyId: "",
        unitId: "",
        tenantId: "",
        priority: "MEDIUM",
        status: "OPEN",
        estimatedCost: "",
        actualCost: "",
      });
    }
    setError(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRequest(null);
    setFormData({
      title: "",
      description: "",
      propertyId: "",
      unitId: "",
      tenantId: "",
      priority: "MEDIUM",
      status: "OPEN",
      estimatedCost: "",
      actualCost: "",
    });
    setError(null);
  };

  const handleSaveRequest = async () => {
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (formData.title.trim().length < 5) {
      setError("Title must be at least 5 characters");
      return;
    }

    if (!formData.description.trim()) {
      setError("Description is required");
      return;
    }

    if (formData.description.trim().length < 10) {
      setError("Description must be at least 10 characters");
      return;
    }

    if (!formData.propertyId) {
      setError("Property is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingRequest
        ? `/api/maintenance-requests/${editingRequest.id}`
        : "/api/maintenance-requests";

      const method = editingRequest ? "PATCH" : "POST";

      const payload: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        status: formData.status,
      };

      if (!editingRequest) {
        // Only set these on create
        payload.propertyId = formData.propertyId;
        payload.unitId = formData.unitId || null;
        payload.tenantId = formData.tenantId || null;
      }

      if (formData.estimatedCost) {
        payload.estimatedCost = parseFloat(formData.estimatedCost);
      }

      if (formData.actualCost) {
        payload.actualCost = parseFloat(formData.actualCost);
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save maintenance request");
      }

      await fetchRequests();
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save request");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!deletingRequest) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/maintenance-requests/${deletingRequest.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete request");
      }

      await fetchRequests();
      setIsDeleteDialogOpen(false);
      setDeletingRequest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete request");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: MaintenanceRequestStatus) => {
    const variants: Record<MaintenanceRequestStatus, "default" | "secondary" | "destructive" | "outline"> = {
      OPEN: "default",
      IN_PROGRESS: "secondary",
      COMPLETED: "outline",
      CANCELLED: "destructive",
    };

    return (
      <Badge variant={variants[status]}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: MaintenanceRequestPriority) => {
    const variants: Record<MaintenanceRequestPriority, "default" | "secondary" | "destructive" | "outline"> = {
      LOW: "outline",
      MEDIUM: "secondary",
      HIGH: "default",
      URGENT: "destructive",
    };

    return <Badge variant={variants[priority]}>{priority}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Maintenance Requests</CardTitle>
              <CardDescription>
                Manage property maintenance requests and work orders
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <HugeiconsIcon icon={PlusSignIcon} size={16} className="mr-2" />
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={16}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Property / Unit</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No maintenance requests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Link
                        href={`/maintenance-requests/${request.id}`}
                        className="font-medium hover:underline"
                      >
                        {request.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{request.property.name}</div>
                        {request.unit && (
                          <div className="text-muted-foreground">{request.unit.name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(request)}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingRequest(request);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRequest ? "Edit Maintenance Request" : "New Maintenance Request"}
            </DialogTitle>
            <DialogDescription>
              {editingRequest
                ? "Update the maintenance request details"
                : "Create a new maintenance request"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief description of the issue"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Detailed description of the maintenance issue"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property">Property *</Label>
                <Select
                  value={formData.propertyId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, propertyId: value, unitId: "" })
                  }
                  disabled={!!editingRequest}
                >
                  <SelectTrigger>
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
                <Label htmlFor="unit">Unit (optional)</Label>
                <Select
                  value={formData.unitId}
                  onValueChange={(value) => setFormData({ ...formData, unitId: value })}
                  disabled={!!editingRequest || !formData.propertyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No unit</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: MaintenanceRequestPriority) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: MaintenanceRequestStatus) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedCost">Estimated Cost</Label>
                <Input
                  id="estimatedCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.estimatedCost}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedCost: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="actualCost">Actual Cost</Label>
                <Input
                  id="actualCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.actualCost}
                  onChange={(e) =>
                    setFormData({ ...formData, actualCost: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            {!editingRequest && (
              <div className="space-y-2">
                <Label htmlFor="tenant">Tenant (optional)</Label>
                <Select
                  value={formData.tenantId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tenantId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No tenant</SelectItem>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveRequest} disabled={isSaving}>
              {isSaving ? "Saving..." : editingRequest ? "Save Changes" : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Maintenance Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingRequest?.title}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRequest}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
