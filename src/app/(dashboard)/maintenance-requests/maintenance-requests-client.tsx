"use client";

import { useEffect, useState, useCallback } from "react";
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
  Download04Icon,
  Upload04Icon,
  FileDownloadIcon,
} from "@hugeicons/core-free-icons";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/components/pagination";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import {
  downloadExcelFile,
  downloadExcelTemplate,
  formatDateForExcel,
} from "@/lib/excel-utils";

type MaintenanceRequestStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
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

export default function MaintenanceRequestsClient() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] =
    useState<MaintenanceRequest | null>(null);
  const [deletingRequest, setDeletingRequest] =
    useState<MaintenanceRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    propertyId: "",
    unitId: "",
    tenantId: "",
    leaseId: "",
    priority: "MEDIUM" as MaintenanceRequestPriority,
    status: "OPEN" as MaintenanceRequestStatus,
    estimatedCost: "",
  });
  const [activeLease, setActiveLease] = useState<{
    id: string;
    tenant: { id: string; fullName: string };
  } | null>(null);

  const fetchProperties = useCallback(async () => {
    try {
      const response = await fetch("/api/properties");
      if (response.ok) {
        const data = await response.json();
        setProperties(data.items || data);
      }
    } catch (err) {
      console.error("Failed to fetch properties:", err);
    }
  }, []);

  const fetchUnitsForProperty = useCallback(async (propertyId: string) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setUnits(data.units || []);
      }
    } catch (err) {
      console.error("Failed to fetch units:", err);
    }
  }, []);

  const fetchActiveLeaseForUnit = useCallback(async (unitId: string) => {
    try {
      const response = await fetch(`/api/units/${unitId}/active-lease`);
      if (response.ok) {
        const data = await response.json();
        if (data.lease) {
          setActiveLease(data.lease);
          setFormData((prev) => ({
            ...prev,
            tenantId: data.lease.tenant.id,
            leaseId: data.lease.id,
          }));
        } else {
          setActiveLease(null);
          setFormData((prev) => ({ ...prev, tenantId: "", leaseId: "" }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch active lease:", err);
      setActiveLease(null);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });

      // Add filters to params
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (priorityFilter && priorityFilter !== "all") {
        params.append("priority", priorityFilter);
      }
      if (propertyFilter && propertyFilter !== "all") {
        params.append("propertyId", propertyFilter);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/maintenance-requests?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch maintenance requests");
      }

      const data = await response.json();
      setRequests(data.items || data);
      setTotalItems(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, statusFilter, priorityFilter, propertyFilter, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (formData.propertyId) {
      fetchUnitsForProperty(formData.propertyId);
    } else {
      setUnits([]);
    }
  }, [formData.propertyId, fetchUnitsForProperty]);

  useEffect(() => {
    if (formData.unitId && !editingRequest) {
      fetchActiveLeaseForUnit(formData.unitId);
    } else {
      setActiveLease(null);
      setFormData((prev) => ({ ...prev, tenantId: "", leaseId: "" }));
    }
  }, [formData.unitId, editingRequest, fetchActiveLeaseForUnit]);

  const handleOpenDialog = async (request?: MaintenanceRequest) => {
    if (request) {
      setEditingRequest(request);
      setFormData({
        title: request.title,
        description: request.description,
        propertyId: request.propertyId,
        unitId: request.unitId || "",
        tenantId: request.tenantId || "",
        leaseId: request.leaseId || "",
        priority: request.priority,
        status: request.status,
        estimatedCost: request.estimatedCost?.toString() || "",
      });
      // Fetch units for the property when editing
      if (request.propertyId) {
        await fetchUnitsForProperty(request.propertyId);
      }
    } else {
      setEditingRequest(null);
      setFormData({
        title: "",
        description: "",
        propertyId: "",
        unitId: "",
        tenantId: "",
        leaseId: "",
        priority: "MEDIUM",
        status: "OPEN",
        estimatedCost: "",
      });
    }
    setError(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRequest(null);
    setActiveLease(null);
    setFormData({
      title: "",
      description: "",
      propertyId: "",
      unitId: "",
      tenantId: "",
      leaseId: "",
      priority: "MEDIUM",
      status: "OPEN",
      estimatedCost: "",
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
      };

      if (!editingRequest) {
        // Only set these on create
        payload.propertyId = formData.propertyId;
        payload.unitId = formData.unitId || null;
        payload.tenantId = formData.tenantId || null;
        payload.leaseId = formData.leaseId || null;
        payload.status = formData.status;
      }

      if (formData.estimatedCost) {
        payload.estimatedCost = parseFloat(formData.estimatedCost);
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
      const response = await fetch(
        `/api/maintenance-requests/${deletingRequest.id}`,
        {
          method: "DELETE",
        },
      );

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
    const variants: Record<
      MaintenanceRequestStatus,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      OPEN: "default",
      IN_PROGRESS: "secondary",
      COMPLETED: "outline",
      CANCELLED: "destructive",
    };

    return <Badge variant={variants[status]}>{status.replace("_", " ")}</Badge>;
  };

  const getPriorityBadge = (priority: MaintenanceRequestPriority) => {
    const variants: Record<
      MaintenanceRequestPriority,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      LOW: "outline",
      MEDIUM: "secondary",
      HIGH: "default",
      URGENT: "destructive",
    };

    return <Badge variant={variants[priority]}>{priority}</Badge>;
  };

  const handleExportToExcel = () => {
    const exportData = requests.map((request) => ({
      Title: request.title,
      Description: request.description,
      Property: request.property.name,
      Unit: request.unit?.name || "No unit",
      Priority: request.priority,
      Status: request.status,
      "Estimated Cost": request.estimatedCost
        ? parseFloat(request.estimatedCost.toString())
        : null,
      "Actual Cost": request.actualCost
        ? parseFloat(request.actualCost.toString())
        : null,
      "Created At": formatDateForExcel(request.createdAt),
      "Completed At": request.completedAt
        ? formatDateForExcel(request.completedAt)
        : null,
    }));

    const today = new Date().toISOString().split("T")[0];
    downloadExcelFile(
      exportData,
      `haventium-maintenance-${today}.xlsx`,
      "Maintenance Requests",
    );
  };

  const handleDownloadTemplate = () => {
    const sampleRow = {
      "Property Name": "Building A",
      "Unit Name": "Unit 101",
      Title: "Leaking faucet in bathroom",
      Description:
        "The bathroom sink faucet is dripping continuously. Needs immediate repair to prevent water waste.",
      Priority: "MEDIUM",
      "Estimated Cost": "150",
    };

    downloadExcelTemplate(sampleRow, "haventium-maintenance-template.xlsx");
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Maintenance Requests</h1>
          <p className="text-muted-foreground mt-1">
            Manage property maintenance requests and work orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <HugeiconsIcon
              icon={FileDownloadIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Download Template
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportToExcel}>
            <HugeiconsIcon
              icon={Download04Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Export to Excel
          </Button>
          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
            <HugeiconsIcon
              icon={Upload04Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Import from Excel
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <HugeiconsIcon
              icon={PlusSignIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            New Request
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Maintenance Requests</CardTitle>
              <CardDescription>
                A list of all your maintenance requests and work orders
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
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 w-[250px]"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={priorityFilter}
                onValueChange={(value) => {
                  setPriorityFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={propertyFilter}
                onValueChange={(value) => {
                  setPropertyFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
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
          </div>
        </CardHeader>
        <CardContent>
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
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No maintenance requests found
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/maintenance-requests/${request.id}`)
                    }
                  >
                    <TableCell>
                      <div className="font-medium">{request.title}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{request.property.name}</div>
                        {request.unit && (
                          <div className="text-muted-foreground">
                            {request.unit.name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(request);
                          }}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
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
          {!isLoading && requests.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRequest
                ? "Edit Maintenance Request"
                : "New Maintenance Request"}
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
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
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
                {editingRequest ? (
                  <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                    {editingRequest.property.name}
                  </div>
                ) : (
                  <Select
                    value={formData.propertyId}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        propertyId: value,
                        unitId: "",
                      })
                    }
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
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                {editingRequest ? (
                  <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                    {editingRequest.unit?.name || "No unit"}
                  </div>
                ) : (
                  <Select
                    value={formData.unitId || "NONE"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        unitId: value === "NONE" ? "" : value,
                      })
                    }
                    disabled={!formData.propertyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No unit</SelectItem>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
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
                <Label htmlFor="tenant">Tenant</Label>
                <Input
                  id="tenant"
                  value={
                    editingRequest
                      ? editingRequest.tenant?.fullName || "No tenant linked"
                      : activeLease
                        ? activeLease.tenant.fullName
                        : "No active lease"
                  }
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveRequest} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingRequest
                  ? "Save Changes"
                  : "Create Request"}
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
            <AlertDialogTitle>Delete Maintenance Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingRequest?.title}
              &rdquo;? This action cannot be undone.
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

      {/* Bulk Import Dialog */}
      <BulkImportDialog<Record<string, unknown>>
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        title="Import Maintenance Requests from Excel"
        description="Upload an Excel file (.xlsx or .xls) with maintenance request data. Download the template for the correct format."
        apiEndpoint="/api/maintenance-requests/bulk-import"
        onImportComplete={fetchRequests}
        renderPreview={(data) => {
          const title = (data["Title"] || data.title) as string;
          const propertyName = (data["Property Name"] ||
            data.propertyName) as string;
          const priority = (data["Priority"] || data.priority) as string;
          return (
            <div className="text-sm">
              <span className="font-medium">{title}</span>
              <span className="text-muted-foreground ml-2">
                {propertyName} • {priority}
              </span>
            </div>
          );
        }}
      />
    </div>
  );
}
