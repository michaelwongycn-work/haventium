"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tab = "email" | "phone";

export default function TenantLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("email");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/auth/org-info")
      .then((r) => r.json())
      .then((data: { name?: string }) => {
        if (data?.name) setOrgName(data.name);
      })
      .catch(() => {});
  }, []);

  function handleTabChange(newTab: Tab) {
    setTab(newTab);
    setIdentifier("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/tenant/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });

      if (res.status === 429) {
        setError("Please wait before requesting another code.");
        return;
      }

      // Always redirect even if tenant not found (prevent enumeration)
      sessionStorage.setItem("tenant-otp-identifier", identifier);
      router.push("/tenant/verify");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {orgName && (
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {orgName}
            </p>
          )}
          <CardTitle className="text-2xl">Tenant Portal</CardTitle>
          <CardDescription>
            Sign in to manage your lease, payments, and requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-muted p-1 mb-4">
            <button
              type="button"
              onClick={() => handleTabChange("email")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
                tab === "email"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("phone")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
                tab === "phone"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Phone (WhatsApp)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">
                {tab === "email" ? "Email address" : "Phone number"}
              </Label>
              <Input
                key={tab}
                id="identifier"
                type={tab === "email" ? "email" : "tel"}
                placeholder={tab === "email" ? "you@example.com" : "+62 812 3456 7890"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
                autoComplete={tab === "email" ? "email" : "tel"}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send code"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
