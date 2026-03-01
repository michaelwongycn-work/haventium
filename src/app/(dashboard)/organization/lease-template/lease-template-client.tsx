"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function LeaseTemplateClient() {
  const [template, setTemplate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/organization/lease-template")
      .then((r) => r.json())
      .then((d: { leaseAgreementTemplate: string | null }) => {
        setTemplate(d.leaseAgreementTemplate ?? "");
      })
      .catch(() => toast.error("Failed to load template"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/organization/lease-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseAgreementTemplate: template.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save template");
        return;
      }

      toast.success("Template saved");
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lease Agreement Template</CardTitle>
        <CardDescription>
          Custom clauses that will appear in the Terms &amp; Conditions section
          of generated lease agreement PDFs. Leave blank to omit the section.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="lease-template">Terms &amp; Conditions Clauses</Label>
              <Textarea
                id="lease-template"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={12}
                className="resize-y font-mono text-sm"
                placeholder="Enter custom lease clauses here..."
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                {template.length} / 10,000 characters
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
