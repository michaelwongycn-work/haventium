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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon, AlertCircleIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

type PortalSettings = {
  subdomain: string | null;
  locked: boolean;
};

const MAIN_HOSTNAME =
  typeof window !== "undefined"
    ? (process.env.PUBLIC_HOSTNAME ?? "haventium.com")
    : "haventium.com";

export function PortalSettingsClient({ hasFeature }: { hasFeature: boolean }) {
  const hasPortalFeature = hasFeature;
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [subdomain, setSubdomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetch("/api/organization/portal")
      .then((r) => r.json())
      .then((d: PortalSettings) => {
        setSettings(d);
        setSubdomain(d.subdomain ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirmSave() {
    setSaving(true);
    setConfirmOpen(false);

    try {
      const res = await fetch("/api/organization/portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain: subdomain.trim() }),
      });

      const data = (await res.json()) as PortalSettings & { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "Failed to save portal settings");
        return;
      }

      setSettings(data);
      setSubdomain(data.subdomain ?? "");
      toast.success("Portal subdomain set. This cannot be changed.");
    } finally {
      setSaving(false);
    }
  }

  const portalUrl = subdomain ? `https://${subdomain}.${MAIN_HOSTNAME}` : null;

  if (!hasPortalFeature) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tenant Portal</CardTitle>
          <CardDescription>
            Configure your tenant self-service portal subdomain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
            <HugeiconsIcon icon={LockIcon} className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Feature not available</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              The tenant portal is not included in your current plan. Upgrade your subscription to enable it.
            </p>
            <Button onClick={() => window.location.href = "/subscribe"}>
              Upgrade Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tenant Portal</CardTitle>
          <CardDescription>
            Configure your tenant self-service portal subdomain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
            </div>
          ) : settings?.locked ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Subdomain</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm max-w-xs flex-1">
                    <HugeiconsIcon icon={LockIcon} className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-mono">{settings.subdomain}</span>
                    <span className="text-muted-foreground">.{MAIN_HOSTNAME}</span>
                  </div>
                </div>
                {portalUrl && (
                  <p className="text-sm text-muted-foreground">
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {portalUrl}
                    </a>
                  </p>
                )}
              </div>
              <Alert>
                <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
                <AlertDescription>
                  Your portal subdomain is permanent and cannot be changed. Contact support if you need help.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    value={subdomain}
                    onChange={(e) =>
                      setSubdomain(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      )
                    }
                    placeholder="kos-tosca"
                    className="max-w-xs"
                  />
                  <span className="text-sm text-muted-foreground">
                    .{MAIN_HOSTNAME}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only lowercase letters, numbers, and hyphens. Once set, this cannot be changed.
                </p>
              </div>
              <Button
                disabled={!subdomain.trim() || saving}
                onClick={() => setConfirmOpen(true)}
              >
                Set subdomain
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Confirm subdomain</DialogTitle>
            <DialogDescription>
              You are about to set your portal subdomain to{" "}
              <strong>{subdomain}.{MAIN_HOSTNAME}</strong>. This cannot be changed later without contacting support.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSave} disabled={saving}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
