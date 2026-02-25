"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

type MR = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  unit: { name: string } | null;
  property: { name: string } | null;
};

export default function TenantMaintenancePage() {
  const [requests, setRequests] = useState<MR[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New request form
  const [title, setTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function loadRequests() {
    fetch("/api/tenant/maintenance-requests")
      .then((r) => r.json())
      .then((d) => {
        const items: MR[] = Array.isArray(d) ? d : d.data ?? [];
        setRequests(items);
        if (items.length > 0 && !selectedId) setSelectedId(items[0].id);
      })
      .catch(() => toast.error("Failed to load maintenance requests."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const selected = requests.find((r) => r.id === selectedId);

  function selectRequest(mr: MR) {
    setSelectedId(mr.id);
    setEditDescription(mr.description);
    setEditing(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !newDescription.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenant/maintenance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: newDescription }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to submit request."); return; }
      setTitle("");
      setNewDescription("");
      setDialogOpen(false);
      toast.success("Maintenance request submitted.");
      setLoading(true);
      loadRequests();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tenant/maintenance-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to save.");
        return;
      }
      const updated = (await res.json()) as MR;
      setRequests((prev) =>
        prev.map((r) => r.id === selected.id ? { ...r, description: updated.description, updatedAt: updated.updatedAt } : r),
      );
      setEditing(false);
      toast.success("Description updated.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <HugeiconsIcon icon={PlusSignIcon} size={15} />
              New request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit a maintenance request</DialogTitle>
              <DialogDescription>Describe the issue and we&apos;ll get it sorted.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="mr-title">Title</Label>
                <Input id="mr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leaking faucet in bathroom" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mr-description">Description</Label>
                <Textarea id="mr-description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Describe the issue in detail…" rows={4} required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {requests.length === 0 ? (
        <p className="text-muted-foreground">No maintenance requests yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_2fr] items-start">
          {/* Sidebar */}
          <div className="space-y-2">
            {requests.map((mr) => {
              const isSelected = mr.id === selectedId;
              return (
                <button
                  key={mr.id}
                  onClick={() => selectRequest(mr)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <p className="font-medium text-sm truncate">{mr.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mr.status.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(mr.createdAt)}</p>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selected.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{selected.status.replace(/_/g, " ")}</dd>
                    <dt className="text-muted-foreground">Property</dt>
                    <dd>{selected.property?.name ?? "—"}</dd>
                    <dt className="text-muted-foreground">Unit</dt>
                    <dd>{selected.unit?.name ?? "—"}</dd>
                    <dt className="text-muted-foreground">Submitted</dt>
                    <dd>{formatDate(selected.createdAt)}</dd>
                    <dt className="text-muted-foreground">Last updated</dt>
                    <dd>{formatDate(selected.updatedAt)}</dd>
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd>{selected.completedAt ? formatDate(selected.completedAt) : "—"}</dd>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Description</CardTitle>
                  {selected.status === "OPEN" && !editing && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
                  )}
                </CardHeader>
                <CardContent>
                  {editing ? (
                    <div className="space-y-3">
                      <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={5} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditDescription(selected.description); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{selected.description}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
