"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";

export default function TenantVerifyPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = sessionStorage.getItem("tenant-otp-identifier");
    if (!id) {
      router.replace("/tenant/login");
      return;
    }
    setIdentifier(id);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/tenant/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, otp }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Invalid or expired code. Please try again.");
        return;
      }

      sessionStorage.removeItem("tenant-otp-identifier");
      router.push("/tenant/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!identifier || resending) return;
    setResending(true);
    setError("");
    try {
      const res = await fetch("/api/tenant/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      if (res.status === 429) {
        toast.error("Please wait before requesting another code.");
      } else if (res.ok) {
        toast.success("A new code has been sent.");
      } else {
        toast.error("Failed to resend. Please try again.");
      }
    } catch {
      toast.error("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Enter your code</CardTitle>
          <CardDescription>
            {identifier ? (
              <>We sent a login code to <strong>{identifier}</strong>. It expires in 10 minutes.</>
            ) : (
              "We sent a login code to your account. It expires in 10 minutes."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
              {loading ? "Verifying…" : "Verify"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
