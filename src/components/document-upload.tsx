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
import { Progress } from "@/components/ui/progress";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Upload04Icon,
  File01Icon,
  Delete02Icon,
  Tick02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

interface DocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: "property" | "unit" | "tenant" | "lease";
  entityId: string;
  onUploadComplete?: () => void;
}

type FileWithStatus = {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

export function DocumentUpload({
  isOpen,
  onClose,
  entityType,
  entityId,
  onUploadComplete,
}: DocumentUploadProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return "File size exceeds 10MB limit";
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Invalid file type. Only PDF and images allowed.";
    }
    return null;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);

    if (files.length + acceptedFiles.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const newFiles: FileWithStatus[] = acceptedFiles.map((file) => {
      const validationError = validateFile(file);
      return {
        file,
        status: validationError ? ("error" as const) : ("pending" as const),
        progress: 0,
        error: validationError || undefined,
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);
  }, [files.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/gif": [".gif"],
      "image/webp": [".webp"],
    },
    maxFiles: MAX_FILES,
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setFiles([]);
    setError(null);
    onClose();
  };

  const uploadFile = async (fileWithStatus: FileWithStatus, index: number) => {
    const formData = new FormData();
    formData.append("file", fileWithStatus.file);
    formData.append("entityType", entityType);
    formData.append("entityId", entityId);

    try {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "uploading" as const, progress: 50 } : f
        )
      );

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload");
      }

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "success" as const, progress: 100 } : f
        )
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: "error" as const,
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : f
        )
      );
    }
  };

  const handleUploadAll = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");

    if (pendingFiles.length === 0) {
      setError("No valid files to upload");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Upload files sequentially to avoid overwhelming the server
      for (let i = 0; i < files.length; i++) {
        if (files[i].status === "pending") {
          await uploadFile(files[i], i);
        }
      }

      // Check if all uploads were successful
      const allSuccess = files.every((f) => f.status === "success");
      if (allSuccess && onUploadComplete) {
        onUploadComplete();
      }

      // If any succeeded, close after a short delay
      if (files.some((f) => f.status === "success")) {
        setTimeout(() => {
          handleClose();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validFilesCount = files.filter((f) => f.status === "pending").length;
  const hasErrors = files.some((f) => f.status === "error");

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Upload files to attach to this {entityType}. You can select multiple files
            (max {MAX_FILES}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}

          {/* Dropzone */}
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
              <p className="text-sm text-primary font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-sm font-medium mb-1">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF and images only • Max 10MB per file • Up to {MAX_FILES} files
                </p>
              </>
            )}
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Selected Files ({files.length})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((fileWithStatus, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-muted rounded-md"
                  >
                    <div className="flex-shrink-0">
                      {fileWithStatus.status === "success" && (
                        <HugeiconsIcon
                          icon={Tick02Icon}
                          size={20}
                          className="text-emerald-500"
                        />
                      )}
                      {fileWithStatus.status === "error" && (
                        <HugeiconsIcon
                          icon={Cancel01Icon}
                          size={20}
                          className="text-destructive"
                        />
                      )}
                      {fileWithStatus.status === "pending" && (
                        <HugeiconsIcon
                          icon={File01Icon}
                          size={20}
                          className="text-muted-foreground"
                        />
                      )}
                      {fileWithStatus.status === "uploading" && (
                        <HugeiconsIcon
                          icon={Upload04Icon}
                          size={20}
                          className="text-primary animate-pulse"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {fileWithStatus.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(fileWithStatus.file.size)}
                      </p>
                      {fileWithStatus.error && (
                        <p className="text-xs text-destructive mt-1">
                          {fileWithStatus.error}
                        </p>
                      )}
                      {fileWithStatus.status === "uploading" && (
                        <Progress
                          value={fileWithStatus.progress}
                          className="h-1 mt-2"
                        />
                      )}
                    </div>

                    {(fileWithStatus.status === "pending" ||
                      fileWithStatus.status === "error") &&
                      !isUploading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={16} />
                        </Button>
                      )}
                  </div>
                ))}
              </div>

              {hasErrors && (
                <p className="text-xs text-muted-foreground">
                  You can remove invalid files or proceed with only valid files.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUploadAll}
            disabled={isUploading || validFilesCount === 0}
          >
            {isUploading
              ? "Uploading..."
              : `Upload ${validFilesCount} File${validFilesCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
