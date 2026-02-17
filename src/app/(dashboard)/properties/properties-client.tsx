"use client";

import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  Building03Icon,
  Download04Icon,
  Upload04Icon,
  FileDownloadIcon,
} from "@hugeicons/core-free-icons";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { downloadExcelFile, downloadExcelTemplate } from "@/lib/excel-utils";

type Property = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    units: number;
  };
};

export default function PropertiesClient({ roles }: { roles: UserRole[] }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(
    null,
  );
  const [propertyName, setPropertyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/properties");

      if (!response.ok) {
        throw new Error("Failed to fetch properties");
      }

      const data = await response.json();
      setProperties(data.items || data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load properties",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      setPropertyName(property.name);
    } else {
      setEditingProperty(null);
      setPropertyName("");
    }
    setError(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProperty(null);
    setPropertyName("");
    setError(null);
  };

  const handleSaveProperty = async () => {
    if (!propertyName.trim()) {
      setError("Property name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingProperty
        ? `/api/properties/${editingProperty.id}`
        : "/api/properties";

      const method = editingProperty ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: propertyName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save property");
      }

      await fetchProperties();
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save property");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteDialog = (property: Property) => {
    setDeletingProperty(property);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingProperty(null);
  };

  const handleDeleteProperty = async () => {
    if (!deletingProperty) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/properties/${deletingProperty.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete property");
      }

      await fetchProperties();
      handleCloseDeleteDialog();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete property",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportToExcel = () => {
    const exportData: Array<{
      "Property Name": string;
      "Unit Name": string;
      "Daily Rate": number | null;
      "Monthly Rate": number | null;
      "Annual Rate": number | null;
      "Is Unavailable": boolean;
    }> = [];

    // Fetch properties with units for export
    fetch("/api/properties")
      .then((res) => res.json())
      .then((data) => {
        const propertiesWithUnits = data.items || data;

        // For each property, fetch units
        const promises = propertiesWithUnits.map((property: Property) =>
          fetch(`/api/properties/${property.id}/units`).then((res) =>
            res.json()
          )
        );

        return Promise.all(promises).then((unitsArrays) => {
          propertiesWithUnits.forEach(
            (property: Property, index: number) => {
              const units = unitsArrays[index].items || unitsArrays[index];
              units.forEach(
                (unit: {
                  name: string;
                  dailyRate: number | null;
                  monthlyRate: number | null;
                  annualRate: number | null;
                  isUnavailable: boolean;
                }) => {
                  exportData.push({
                    "Property Name": property.name,
                    "Unit Name": unit.name,
                    "Daily Rate": unit.dailyRate,
                    "Monthly Rate": unit.monthlyRate,
                    "Annual Rate": unit.annualRate,
                    "Is Unavailable": unit.isUnavailable,
                  });
                }
              );
            }
          );

          const today = new Date().toISOString().split("T")[0];
          downloadExcelFile(
            exportData,
            `haventium-properties-${today}.xlsx`,
            "Properties"
          );
        });
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to export properties"
        );
      });
  };

  const handleDownloadTemplate = () => {
    const headers = {
      "Property Name": "Property Name",
      "Unit Name": "Unit Name",
      "Daily Rate": "Daily Rate",
      "Monthly Rate": "Monthly Rate",
      "Annual Rate": "Annual Rate",
      "Is Unavailable": "Is Unavailable",
    };

    const sampleRow = {
      "Property Name": "Building A",
      "Unit Name": "Unit 101",
      "Daily Rate": "50",
      "Monthly Rate": "1200",
      "Annual Rate": "12000",
      "Is Unavailable": "FALSE",
    };

    downloadExcelTemplate(
      headers,
      sampleRow,
      "haventium-properties-template.xlsx",
      "Properties"
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Properties</h1>
          <p className="text-muted-foreground mt-1">
            Manage your rental properties
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasAccess(roles, "properties", "create") && (
            <>
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
                Add Property
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Properties</CardTitle>
          <CardDescription>
            A list of all your rental properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-[180px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[220px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
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
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <HugeiconsIcon
                icon={Building03Icon}
                strokeWidth={1.5}
                className="mx-auto h-12 w-12 text-muted-foreground mb-4"
              />
              <h3 className="text-lg font-medium mb-2">No properties yet</h3>
              <p className="text-muted-foreground mb-6">
                Get started by creating your first property
              </p>
              {hasAccess(roles, "properties", "create") && (
                <Button onClick={() => handleOpenDialog()}>
                  <HugeiconsIcon
                    icon={PlusSignIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Add Property
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow
                    key={property.id}
                    className="cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/properties/${property.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      {property.name}
                    </TableCell>
                    <TableCell>{property._count.units} units</TableCell>
                    <TableCell>
                      {new Date(property.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {hasAccess(roles, "properties", "update") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(property)}
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
                            onClick={() => handleOpenDeleteDialog(property)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProperty ? "Edit Property" : "Add New Property"}
            </DialogTitle>
            <DialogDescription>
              {editingProperty
                ? "Update the property details below"
                : "Enter the details for your new property"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="property-name">Property Name *</Label>
              <Input
                id="property-name"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="e.g., Sunset Apartments"
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
            <Button onClick={handleSaveProperty} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingProperty
                  ? "Update Property"
                  : "Create Property"}
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
              {"This will permanently delete the property '"}
              {deletingProperty?.name}
              {"' and all"}
              associated units. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProperty}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? "Deleting..." : "Delete Property"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Import Dialog */}
      <BulkImportDialog<Record<string, unknown>>
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        title="Import Properties from Excel"
        description="Upload an Excel file (.xlsx or .xls) with property and unit data. Download the template for the correct format."
        apiEndpoint="/api/properties/bulk-import"
        onImportComplete={fetchProperties}
        renderPreview={(data, index) => {
          const propertyName = (data["Property Name"] || data.propertyName) as string;
          const unitName = (data["Unit Name"] || data.unitName) as string;
          return (
            <div className="text-sm">
              <span className="font-medium">{propertyName}</span>
              <span className="text-muted-foreground ml-2">/ {unitName}</span>
            </div>
          );
        }}
      />
    </div>
  );
}
