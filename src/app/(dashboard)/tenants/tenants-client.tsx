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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  UserIcon,
  Search01Icon,
  Download04Icon,
  Upload04Icon,
  FileDownloadIcon,
} from "@hugeicons/core-free-icons";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { downloadExcelFile, downloadExcelTemplate } from "@/lib/excel-utils";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/components/pagination";

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
  _count: {
    leaseAgreements: number;
  };
};

export default function TenantsClient() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    status: "LEAD" as TenantStatus,
    preferEmail: false,
    preferWhatsapp: false,
    preferTelegram: false,
  });

  const fetchTenants = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });

      // Add filters to API request
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/tenants?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch tenants");
      }

      const data = await response.json();
      setTenants(data.items || data);
      setFilteredTenants(data.items || data); // Set filtered tenants from API response
      setTotalItems(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, statusFilter, searchQuery]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleOpenDialog = (tenant?: Tenant) => {
    if (tenant) {
      setEditingTenant(tenant);
      setFormData({
        fullName: tenant.fullName,
        email: tenant.email,
        phone: tenant.phone,
        status: tenant.status,
        preferEmail: tenant.preferEmail,
        preferWhatsapp: tenant.preferWhatsapp,
        preferTelegram: tenant.preferTelegram,
      });
    } else {
      setEditingTenant(null);
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        status: "LEAD",
        preferEmail: false,
        preferWhatsapp: false,
        preferTelegram: false,
      });
    }
    setError(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTenant(null);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      status: "LEAD",
      preferEmail: false,
      preferWhatsapp: false,
      preferTelegram: false,
    });
    setError(null);
  };

  const handleSaveTenant = async () => {
    if (!formData.fullName.trim()) {
      setError("Full name is required");
      return;
    }

    // At least one contact method required
    if (!formData.email.trim() && !formData.phone.trim()) {
      setError("At least one contact method (email or phone) is required");
      return;
    }

    // Validate email format if provided
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError("Please enter a valid email address");
        return;
      }
    }

    // Validate phone format if provided
    if (formData.phone.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (
        !phoneRegex.test(formData.phone) ||
        formData.phone.replace(/\D/g, "").length < 8
      ) {
        setError("Please enter a valid phone number (at least 8 digits)");
        return;
      }
    }

    // Validate preferences match available contact methods
    if (formData.preferEmail && !formData.email.trim()) {
      setError("Cannot prefer email without providing an email address");
      return;
    }

    if (formData.preferWhatsapp && !formData.phone.trim()) {
      setError("Cannot prefer WhatsApp without providing a phone number");
      return;
    }

    if (formData.preferTelegram && !formData.phone.trim()) {
      setError("Cannot prefer Telegram without providing a phone number");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingTenant
        ? `/api/tenants/${editingTenant.id}`
        : "/api/tenants";

      const method = editingTenant ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save tenant");
      }

      await fetchTenants();
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tenant");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteDialog = (tenant: Tenant) => {
    setDeletingTenant(tenant);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingTenant(null);
  };

  const handleDeleteTenant = async () => {
    if (!deletingTenant) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/tenants/${deletingTenant.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete tenant");
      }

      await fetchTenants();
      handleCloseDeleteDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tenant");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportToExcel = () => {
    const exportData = tenants.map((tenant) => ({
      "Full Name": tenant.fullName,
      Email: tenant.email,
      Phone: tenant.phone,
      Status: tenant.status,
      "Prefer Email": tenant.preferEmail,
      "Prefer WhatsApp": tenant.preferWhatsapp,
      "Prefer Telegram": tenant.preferTelegram,
      "Created At": formatDate(tenant.createdAt),
    }));

    const today = new Date().toISOString().split("T")[0];
    downloadExcelFile(exportData, `haventium-tenants-${today}.xlsx`, "Tenants");
  };

  const handleDownloadTemplate = () => {
    const sampleRow = {
      "Full Name": "John Doe",
      Email: "john.doe@example.com",
      Phone: "+1234567890",
      Status: "LEAD",
      "Prefer Email": "TRUE",
      "Prefer WhatsApp": "FALSE",
      "Prefer Telegram": "FALSE",
    };

    downloadExcelTemplate(
      sampleRow,
      "haventium-tenants-template.xlsx",
      "Tenants"
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tenants and leads
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
            Add Tenant
          </Button>
        </div>
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
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to page 1 when search changes
                  }}
                  className="pl-8 w-[250px]"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1); // Reset to page 1 when filter changes
                }}
              >
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leases</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-[150px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[180px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[120px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-[70px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[30px]" />
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
                  <HugeiconsIcon
                    icon={PlusSignIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
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
                    onClick={() =>
                      (window.location.href = `/tenants/${tenant.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      {tenant.fullName}
                    </TableCell>
                    <TableCell>{tenant.email || "—"}</TableCell>
                    <TableCell>{tenant.phone || "—"}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {tenant.status.toLowerCase()}
                    </TableCell>
                    <TableCell>
                      {formatDate(tenant.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(tenant)}
                        >
                          <HugeiconsIcon
                            icon={PencilEdit02Icon}
                            strokeWidth={2}
                            className="h-4 w-4"
                          />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDeleteDialog(tenant)}
                        >
                          <HugeiconsIcon
                            icon={Delete02Icon}
                            strokeWidth={2}
                            className="h-4 w-4"
                          />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && filteredTenants.length > 0 && (
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
              <p className="text-xs text-muted-foreground">
                Used for WhatsApp and Telegram notifications
              </p>
            </div>
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium">
                Preferred Communication Channel
              </Label>
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
                <Label
                  htmlFor="prefer-whatsapp"
                  className="text-sm font-normal"
                >
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
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="prefer-telegram"
                  className="text-sm font-normal"
                >
                  Prefer Telegram
                </Label>
                <Switch
                  id="prefer-telegram"
                  checked={formData.preferTelegram}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, preferTelegram: checked })
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
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {"This will permanently delete the tenant '"}
              {deletingTenant?.fullName}
              {"' and all"}
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

      {/* Bulk Import Dialog */}
      <BulkImportDialog<Record<string, unknown>>
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        title="Import Tenants from Excel"
        description="Upload an Excel file (.xlsx or .xls) with tenant data. Download the template for the correct format."
        apiEndpoint="/api/tenants/bulk-import"
        onImportComplete={fetchTenants}
        renderPreview={(data) => {
          const fullName = (data["Full Name"] || data.fullName) as string;
          const email = (data.Email || data.email) as string;
          return (
            <div className="text-sm">
              <span className="font-medium">{fullName}</span>
              <span className="text-muted-foreground ml-2">{email}</span>
            </div>
          );
        }}
      />
    </div>
  );
}
