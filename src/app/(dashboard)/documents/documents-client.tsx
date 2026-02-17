"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
  Search01Icon,
  ViewIcon,
  File01Icon,
} from "@hugeicons/core-free-icons";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/components/pagination";

type Document = {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
  property: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  tenant: { id: string; fullName: string } | null;
  lease: { id: string } | null;
};

type Property = {
  id: string;
  name: string;
};

type Tenant = {
  id: string;
  fullName: string;
};

export default function DocumentsClient() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [formData, setFormData] = useState({
    file: null as File | null,
    entityType: "",
    entityId: "",
  });

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });
      const response = await fetch(`/api/documents?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      setDocuments(data.items || data);
      setTotalItems(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize]);

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

  const fetchTenants = useCallback(async () => {
    try {
      const response = await fetch("/api/tenants");
      if (response.ok) {
        const data = await response.json();
        setTenants(data.items || data);
      }
    } catch (err) {
      console.error("Failed to fetch tenants:", err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchProperties();
    fetchTenants();
  }, [fetchDocuments, fetchProperties, fetchTenants]);

  const filterDocuments = useCallback(() => {
    let filtered = documents;

    if (entityTypeFilter !== "all") {
      filtered = filtered.filter((doc) => {
        switch (entityTypeFilter) {
          case "property":
            return doc.property !== null;
          case "tenant":
            return doc.tenant !== null;
          case "lease":
            return doc.lease !== null;
          default:
            return true;
        }
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) =>
        doc.filename.toLowerCase().includes(query),
      );
    }

    setFilteredDocuments(filtered);
  }, [documents, entityTypeFilter, searchQuery]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    filterDocuments();
  }, [filterDocuments]);

  const handleOpenDialog = () => {
    setFormData({
      file: null,
      entityType: "",
      entityId: "",
    });
    setError(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setFormData({
      file: null,
      entityType: "",
      entityId: "",
    });
    setError(null);
  };

  const handleUploadDocument = async () => {
    if (!formData.file) {
      setError("Please select a file");
      return;
    }

    if (!formData.entityType || !formData.entityId) {
      setError("Please select an entity to attach the document to");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const uploadData = new FormData();
      uploadData.append("file", formData.file);
      uploadData.append("entityType", formData.entityType);
      uploadData.append("entityId", formData.entityId);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: uploadData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload document");
      }

      await fetchDocuments();
      handleCloseDialog();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload document",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deletingDocument) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${deletingDocument.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete document");
      }

      await fetchDocuments();
      setIsDeleteDialogOpen(false);
      setDeletingDocument(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete document",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getEntityInfo = (doc: Document) => {
    if (doc.lease) return { type: "Lease", name: "Lease Agreement" };
    if (doc.tenant) return { type: "Tenant", name: doc.tenant.fullName };
    if (doc.unit) return { type: "Unit", name: doc.unit.name };
    if (doc.property) return { type: "Property", name: doc.property.name };
    return { type: "Unknown", name: "-" };
  };

  const getEntitiesForType = () => {
    switch (formData.entityType) {
      case "property":
        return properties.map((p) => ({ id: p.id, name: p.name }));
      case "tenant":
        return tenants.map((t) => ({ id: t.id, name: t.fullName }));
      default:
        return [];
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Manage files and documents attached to properties, units,
                tenants, and leases
              </CardDescription>
            </div>
            <Button onClick={handleOpenDialog}>
              <HugeiconsIcon icon={PlusSignIcon} size={16} className="mr-2" />
              Upload Document
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
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={entityTypeFilter}
              onValueChange={setEntityTypeFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="property">Property</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
                <SelectItem value="lease">Lease</SelectItem>
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
                <TableHead className="w-16">Preview</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Attached To</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No documents found
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => {
                  const entityInfo = getEntityInfo(doc);
                  const isImage = doc.fileType.startsWith("image/");
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <button
                          onClick={() => window.open(doc.fileUrl, "_blank")}
                          className="block"
                        >
                          {isImage ? (
                            <Image
                              src={doc.fileUrl}
                              alt={doc.filename}
                              width={48}
                              height={48}
                              className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-12 h-12 flex items-center justify-center bg-muted rounded">
                              <HugeiconsIcon
                                icon={File01Icon}
                                size={24}
                                className="text-muted-foreground"
                              />
                            </div>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {doc.filename}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {doc.fileType.split("/")[1].toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-muted-foreground text-xs">
                            {entityInfo.type}
                          </div>
                          <div>{entityInfo.name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(doc.fileUrl, "_blank")}
                          >
                            <HugeiconsIcon icon={ViewIcon} size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingDocument(doc);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <HugeiconsIcon icon={Delete02Icon} size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {!isLoading && filteredDocuments.length > 0 && (
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

      {/* Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document and attach it to a property, unit, tenant, or
              lease
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="file">File *</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setFormData({ ...formData, file });
                }}
              />
              <p className="text-xs text-muted-foreground">
                PDF and images only. Max 10MB.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entityType">Attach To *</Label>
              <Select
                value={formData.entityType}
                onValueChange={(value) =>
                  setFormData({ ...formData, entityType: value, entityId: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.entityType && (
              <div className="space-y-2">
                <Label htmlFor="entityId">
                  {formData.entityType === "property" ? "Property" : "Tenant"} *
                </Label>
                <Select
                  value={formData.entityId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, entityId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={`Select ${formData.entityType}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {getEntitiesForType().map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleUploadDocument} disabled={isSaving}>
              {isSaving ? "Uploading..." : "Upload"}
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
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {deletingDocument?.filename}&rdquo;? This action cannot be undone.
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
              onClick={handleDeleteDocument}
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
