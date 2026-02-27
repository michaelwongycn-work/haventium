"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SubscriptionStatus = "PENDING_PAYMENT" | "EXPIRED" | "ACTIVE" | string;

export default function SubscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentParam = searchParams.get("payment");

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);

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
                    toast.error(
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
      toast.error("Payment was not completed. Please try again.");
    }
  }, [paymentParam]);

  // Fetch current subscription status and existing pending payment link
  useEffect(() => {
    if (paymentParam) return;

    const init = async () => {
      try {
        // Get current status from session
        const sessionRes = await fetch("/api/subscribe/refresh-session", {
          method: "POST",
        });
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          setSubscriptionStatus(data.status ?? null);
        }

        // For PENDING_PAYMENT, reuse an existing link if available
        const pendingRes = await fetch("/api/subscribe/pending-payment");
        if (pendingRes.ok) {
          const data = await pendingRes.json();
          if (data.paymentLinkUrl) {
            setPaymentLinkUrl(data.paymentLinkUrl);
          }
        }
      } catch {
        // ignore
      }
    };

    init();
  }, [paymentParam, router]);

  const handlePay = async () => {
    if (paymentLinkUrl) {
      window.location.href = paymentLinkUrl;
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/subscribe/create-payment", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create payment link");
        return;
      }
      if (data.paymentLinkUrl) {
        window.location.href = data.paymentLinkUrl;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
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

  const isExpired = subscriptionStatus === "EXPIRED";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isExpired ? "Subscription Expired" : "Complete Your Subscription"}
          </CardTitle>
          <CardDescription>
            {isExpired
              ? "Your subscription has expired. Renew now to restore full access to Haventium. Your data is safe and intact."
              : "Your subscription payment is pending. Please complete payment to access all features."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={handlePay}
            disabled={isLoading}
          >
            {isLoading
              ? "Loading..."
              : isExpired
                ? "Renew Subscription"
                : "Pay Now"}
          </Button>
          <p className="text-xs text-muted-foreground">
            You will be redirected to the secure Xendit payment page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
