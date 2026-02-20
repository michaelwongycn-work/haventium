"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SubscribePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);

  useEffect(() => {
    // Fetch existing pending payment transaction for this subscription
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
    fetchPendingPayment();
  }, []);

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
