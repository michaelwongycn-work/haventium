"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Upload04Icon,
  Tick02Icon,
  Cancel01Icon,
  File02Icon,
} from "@hugeicons/core-free-icons";
import { parseExcelFile } from "@/lib/excel-utils";

interface BulkImportDialogProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  apiEndpoint: string;
  onImportComplete?: () => void;
  renderPreview: (data: T, index: number) => React.ReactNode;
}

type ValidationResult<T> = {
  rowIndex: number;
  data: T;
  errors: string[];
};

type ApiResponse<T> = {
  summary: {
    total: number;
    valid: number;
    invalid: number;
    created: number;
  };
  validRows: ValidationResult<T>[];
  invalidRows: ValidationResult<T>[];
  createdIds?: string[];
};

export function BulkImportDialog<T = Record<string, unknown>>({
  isOpen,
  onClose,
  title,
  description,
  apiEndpoint,
  onImportComplete,
  renderPreview,
}: BulkImportDialogProps<T>) {
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] =
    useState<ApiResponse<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    setValidationResult(null);

    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleValidate = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Parse Excel file
      const rows = await parseExcelFile<T>(file);

      if (rows.length === 0) {
        setError("Excel file is empty");
        setIsValidating(false);
        return;
      }

      // Send to API for validation (dryRun mode)
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dryRun: true,
          rows,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Validation failed");
      }

      setValidationResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate file");
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file || !validationResult) {
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      // Parse Excel file again
      const rows = await parseExcelFile<T>(file);

      // Send to API for actual import
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dryRun: false,
          rows,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      // Success
      if (onImportComplete) {
        onImportComplete();
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import data");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setValidationResult(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}

          {/* File Upload */}
          {!validationResult && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <HugeiconsIcon
                icon={Upload04Icon}
                size={48}
                className="mx-auto mb-4 text-muted-foreground"
              />
              {isDragActive ? (
                <p className="text-sm text-primary font-medium">
                  Drop Excel file here...
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium mb-1">
                    Drag & drop Excel file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports .xlsx and .xls files
                  </p>
                </>
              )}
            </div>
          )}

          {/* Selected File */}
          {file && !validationResult && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
              <HugeiconsIcon
                icon={File02Icon}
                size={24}
                className="text-muted-foreground"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setValidationResult(null);
                }}
              >
                Remove
              </Button>
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Total Rows</p>
                  <p className="text-2xl font-bold">
                    {validationResult.summary.total}
                  </p>
                </div>
                <div className="p-4 bg-emerald-500/10 rounded-lg">
                  <p className="text-xs text-emerald-700 mb-1">Valid Rows</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {validationResult.summary.valid}
                  </p>
                </div>
                <div className="p-4 bg-destructive/10 rounded-lg">
                  <p className="text-xs text-destructive mb-1">Invalid Rows</p>
                  <p className="text-2xl font-bold text-destructive">
                    {validationResult.summary.invalid}
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border rounded-lg max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Status</TableHead>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResult.validRows.map((row, index) => (
                      <TableRow key={`valid-${index}`}>
                        <TableCell>
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            size={20}
                            className="text-emerald-500"
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.rowIndex}
                        </TableCell>
                        <TableCell>
                          {renderPreview(row.data, index)}
                        </TableCell>
                        <TableCell>-</TableCell>
                      </TableRow>
                    ))}
                    {validationResult.invalidRows.map((row, index) => (
                      <TableRow key={`invalid-${index}`}>
                        <TableCell>
                          <HugeiconsIcon
                            icon={Cancel01Icon}
                            size={20}
                            className="text-destructive"
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.rowIndex}
                        </TableCell>
                        <TableCell>
                          {renderPreview(row.data, index)}
                        </TableCell>
                        <TableCell>
                          <ul className="text-xs text-destructive space-y-1">
                            {row.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {validationResult.summary.invalid > 0 && (
                <p className="text-sm text-muted-foreground">
                  You can fix errors in the Excel file and re-upload, or proceed to
                  import only the valid rows.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isValidating || isImporting}>
            Cancel
          </Button>

          {!validationResult && (
            <Button
              onClick={handleValidate}
              disabled={!file || isValidating}
            >
              {isValidating ? "Validating..." : "Validate"}
            </Button>
          )}

          {validationResult && validationResult.summary.valid > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setValidationResult(null);
                }}
                disabled={isImporting}
              >
                Upload Different File
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting
                  ? "Importing..."
                  : `Import ${validationResult.summary.valid} Row${validationResult.summary.valid !== 1 ? "s" : ""}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
