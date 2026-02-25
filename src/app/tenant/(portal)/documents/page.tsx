"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@hugeicons/core-free-icons";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

type Doc = {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  property: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  lease: { id: string; startDate: string; endDate: string } | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TenantDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/documents")
      .then((r) => r.json())
      .then((d) => {
        const items: Doc[] = Array.isArray(d) ? d : d.data ?? [];
        setDocs(items);
        if (items.length > 0) setSelectedId(items[0].id);
      })
      .catch(() => toast.error("Failed to load documents."))
      .finally(() => setLoading(false));
  }, []);

  const selected = docs.find((d) => d.id === selectedId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Documents</h1>

      {docs.length === 0 ? (
        <p className="text-muted-foreground">No documents found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_2fr] items-start">
          {/* Sidebar */}
          <div className="space-y-2">
            {docs.map((doc) => {
              const isSelected = doc.id === selectedId;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedId(doc.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <p className="font-medium text-sm truncate">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.fileType} · {formatBytes(doc.fileSize)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(doc.createdAt)}</p>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <CardTitle className="text-base break-all">{selected.filename}</CardTitle>
                <Button asChild size="sm" className="gap-2 shrink-0">
                  <a href={`/api/tenant/documents/${selected.id}`} target="_blank" rel="noopener noreferrer">
                    <HugeiconsIcon icon={Download01Icon} size={15} />
                    Download
                  </a>
                </Button>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>{selected.fileType}</dd>
                  <dt className="text-muted-foreground">Size</dt>
                  <dd>{formatBytes(selected.fileSize)}</dd>
                  <dt className="text-muted-foreground">Added</dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                  <dt className="text-muted-foreground">Property</dt>
                  <dd>{selected.property?.name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Unit</dt>
                  <dd>{selected.unit?.name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Lease period</dt>
                  <dd>{selected.lease ? `${formatDate(selected.lease.startDate)} — ${formatDate(selected.lease.endDate)}` : "—"}</dd>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
