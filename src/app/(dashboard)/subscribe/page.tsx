"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SubscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentParam = searchParams.get("payment");

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);

  // On return from Xendit redirect, refresh session then go to dashboard
  useEffect(() => {
    if (paymentParam === "success") {
      setIsRefreshing(true);
      fetch("/api/subscribe/refresh-session", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "ACTIVE") {
            router.replace("/");
          } else {
            // Webhook may still be processing — retry after a short delay
            setTimeout(() => {
              fetch("/api/subscribe/refresh-session", { method: "POST" })
                .then((r) => r.json())
                .then((d) => {
                  if (d.status === "ACTIVE") {
                    router.replace("/");
                  } else {
                    setIsRefreshing(false);
                    setError(
                      "Payment received but not yet confirmed. Please wait a moment and try again, or contact support.",
                    );
                  }
                })
                .catch(() => setIsRefreshing(false));
            }, 4000);
          }
        })
        .catch(() => setIsRefreshing(false));
    }
  }, [paymentParam, router]);

  useEffect(() => {
    if (paymentParam === "failed") {
      setError("Payment was not completed. Please try again.");
    }
  }, [paymentParam]);

  // Fetch existing pending payment link
  useEffect(() => {
    const fetchPendingPayment = async () => {
      try {
        const res = await fetch("/api/subscribe/pending-payment");
        if (res.ok) {
          const data = await res.json();
          if (data.paymentLinkUrl) {
            setPaymentLinkUrl(data.paymentLinkUrl);
          }
        }
      } catch {
        // ignore
      }
    };
    if (!paymentParam) {
      fetchPendingPayment();
    }
  }, [paymentParam]);

  const handlePay = async () => {
    if (paymentLinkUrl) {
      window.location.href = paymentLinkUrl;
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe/create-payment", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create payment link");
        return;
      }
      if (data.paymentLinkUrl) {
        window.location.href = data.paymentLinkUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isRefreshing) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Confirming Payment...</CardTitle>
            <CardDescription>
              Please wait while we verify your payment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Your Subscription</CardTitle>
          <CardDescription>
            Your subscription payment is pending. Please complete payment to
            access all features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button
            className="w-full"
            onClick={handlePay}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Pay Now"}
          </Button>
          <p className="text-xs text-muted-foreground">
            You will be redirected to the secure Xendit payment page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
