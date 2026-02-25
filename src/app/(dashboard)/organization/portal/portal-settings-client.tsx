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

type PortalSettings = {
  subdomain: string | null;
};

const MAIN_HOSTNAME =
  typeof window !== "undefined"
    ? (process.env.PUBLIC_HOSTNAME ?? "haventium.com")
    : "haventium.com";

export function PortalSettingsClient() {
  const [, setSettings] = useState<PortalSettings>({
    subdomain: null,
  });
  const [subdomain, setSubdomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/organization/portal")
      .then((r) => r.json())
      .then((d: PortalSettings) => {
        setSettings(d);
        setSubdomain(d.subdomain ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/organization/portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain: subdomain.trim() || null,
        }),
      });

      const data = (await res.json()) as PortalSettings & { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to save portal settings");
        return;
      }

      setSettings(data);
      setSubdomain(data.subdomain ?? "");
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  const portalPreviewUrl = subdomain
    ? `https://${subdomain}.${MAIN_HOSTNAME}`
    : null;

  return (
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
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
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
              {portalPreviewUrl && (
                <p className="text-sm text-muted-foreground">
                  Preview:{" "}
                  <a
                    href={portalPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {portalPreviewUrl}
                  </a>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Only lowercase letters, numbers, and hyphens allowed.
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400">
                Portal settings saved.
              </div>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
