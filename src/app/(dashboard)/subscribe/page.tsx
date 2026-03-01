"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TierType = "FREE" | "NORMAL" | "PRO";

interface SubscriptionTier {
  id: string;
  type: TierType;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  maxUsers: number;
  maxProperties: number;
  maxUnits: number;
  maxTenants: number;
  features: string[];
}

interface SubscriptionState {
  status: string;
  tierId: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  endDate: string | null;
  startDate: string | null;
  tier: { id: string; type: string; name: string; monthlyPrice: number; annualPrice: number } | null;
}

interface ProratePreview {
  credit: number;
  newFullPrice: number;
  charge: number;
  daysRemaining: number;
  totalDays: number;
  newPeriodStart: string;
  newPeriodEnd: string;
}

function formatPrice(price: number): string {
  if (price === 0) return "Gratis";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SubscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentParam = searchParams.get("payment");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [confirmTier, setConfirmTier] = useState<SubscriptionTier | null>(null);
  const [confirmBillingCycle, setConfirmBillingCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [proratePreview, setProratePreview] = useState<ProratePreview | null>(null);
  const [isProrateLoading, setIsProrateLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

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
      return;
    }

    if (paymentParam === "failed") {
      toast.error("Payment was not completed. Please try again.");
    }
  }, [paymentParam, router]);

  // Fetch tiers + current subscription
  useEffect(() => {
    if (paymentParam === "success") return;

    const init = async () => {
      setIsLoading(true);
      try {
        const [tiersRes, sessionRes] = await Promise.all([
          fetch("/api/subscription-tiers"),
          fetch("/api/subscribe/refresh-session", { method: "POST" }),
        ]);
        if (tiersRes.ok) {
          const data = await tiersRes.json();
          setTiers(data.items ?? []);
        }
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          const sub = data.subscription;
          if (sub) {
            setSubscription({
              status: sub.status,
              tierId: sub.tierId,
              billingCycle: sub.billingCycle,
              endDate: sub.endDate,
              startDate: sub.startDate,
              tier: sub.tier,
            });
          }
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [paymentParam]);

  const fetchProratePreview = useCallback(async (tierId: string, billingCycle: "MONTHLY" | "ANNUAL") => {
    setIsProrateLoading(true);
    setProratePreview(null);
    try {
      const res = await fetch(`/api/subscribe/prorate?tierId=${tierId}&billingCycle=${billingCycle}`);
      if (res.ok) {
        const data = await res.json();
        setProratePreview(data);
      }
    } catch {
      // ignore — we'll show basic info
    } finally {
      setIsProrateLoading(false);
    }
  }, []);

  const handleSelectTier = (tier: SubscriptionTier) => {
    if (!subscription) return;
    if (tier.id === subscription.tierId && subscription.status === "ACTIVE") return;

    const billingCycle = subscription.billingCycle;
    setConfirmTier(tier);
    setConfirmBillingCycle(billingCycle);

    // Fetch proration preview for non-FREE tiers when ACTIVE
    if (subscription.status === "ACTIVE") {
      fetchProratePreview(tier.id, billingCycle);
    }
  };

  const handleConfirm = async () => {
    if (!confirmTier || !subscription) return;
    setIsConfirming(true);
    try {
      const res = await fetch("/api/subscribe/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: confirmTier.id, billingCycle: confirmBillingCycle }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to process request");
        return;
      }

      if (data.switched) {
        toast.success(`Switched to ${confirmTier.name} plan.`);
        setConfirmTier(null);
        router.replace("/");
        return;
      }

      if (data.paymentLinkUrl) {
        window.location.href = data.paymentLinkUrl;
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRenew = async () => {
    setIsConfirming(true);
    try {
      const res = await fetch("/api/subscribe/create-payment", { method: "POST" });
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
      setIsConfirming(false);
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

  // Simple view for PENDING_PAYMENT (new user) and EXPIRED — just show pay button
  if (!isLoading && subscription && (subscription.status === "PENDING_PAYMENT" || subscription.status === "EXPIRED")) {
    const isExpired = subscription.status === "EXPIRED";
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
            <Button className="w-full" onClick={handleRenew} disabled={isConfirming}>
              {isConfirming ? "Loading..." : isExpired ? "Renew Subscription" : "Pay Now"}
            </Button>
            <p className="text-xs text-muted-foreground">
              You will be redirected to the secure Xendit payment page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ACTIVE state — full tier management
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* Current plan summary */}
      {subscription && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-lg font-semibold">{subscription.tier?.name ?? "Unknown"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-lg font-semibold capitalize">{subscription.status.toLowerCase().replace("_", " ")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Billing</p>
                <p className="text-lg font-semibold capitalize">{subscription.billingCycle.toLowerCase()}</p>
              </div>
              {subscription.endDate && subscription.tier?.type !== "FREE" && (
                <div>
                  <p className="text-sm text-muted-foreground">Renews</p>
                  <p className="text-lg font-semibold">{formatDate(subscription.endDate)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => {
            const isCurrent = subscription?.tierId === tier.id && subscription?.status === "ACTIVE";
            const price = subscription?.billingCycle === "ANNUAL" ? tier.annualPrice : tier.monthlyPrice;
            const suffix = tier.monthlyPrice === 0 ? "" : subscription?.billingCycle === "ANNUAL" ? "/yr" : "/bln";

            let actionLabel = "Select";
            let actionVariant: "default" | "outline" | "secondary" = "default";
            let actionDisabled = false;

            if (isCurrent) {
              actionLabel = "Current Plan";
              actionVariant = "secondary";
              actionDisabled = true;
            } else if (subscription) {
              const currentTierType = subscription.tier?.type as TierType | undefined;
              const tierTypes: TierType[] = ["FREE", "NORMAL", "PRO"];
              const currentIdx = tierTypes.indexOf(currentTierType ?? "FREE");
              const targetIdx = tierTypes.indexOf(tier.type);
              actionLabel = targetIdx > currentIdx ? "Upgrade →" : "Downgrade";
              actionVariant = targetIdx > currentIdx ? "default" : "outline";
            }

            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col ${isCurrent ? "border-primary" : ""}`}
              >
                {isCurrent && (
                  <div className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Current
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tier.name}</CardTitle>
                  <div className="mt-1">
                    <span className="text-2xl font-bold">{formatPrice(price)}</span>
                    {suffix && (
                      <span className="text-sm text-muted-foreground">{suffix}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>Up to {tier.maxUsers} users</li>
                    <li>Up to {tier.maxProperties} properties</li>
                    <li>Up to {tier.maxUnits} units</li>
                    {tier.features.map((f) => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                  <Button
                    variant={actionVariant}
                    size="sm"
                    className="mt-auto w-full"
                    disabled={actionDisabled}
                    onClick={() => !actionDisabled && handleSelectTier(tier)}
                  >
                    {actionLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Confirmation modal */}
      <Dialog open={!!confirmTier} onOpenChange={(open) => !open && setConfirmTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(() => {
                if (!subscription || !confirmTier) return "Change Plan";
                const tierTypes: TierType[] = ["FREE", "NORMAL", "PRO"];
                const currentIdx = tierTypes.indexOf(subscription.tier?.type as TierType ?? "FREE");
                const targetIdx = tierTypes.indexOf(confirmTier.type);
                if (confirmTier.monthlyPrice === 0) return `Switch to ${confirmTier.name}`;
                return targetIdx > currentIdx ? `Upgrade to ${confirmTier.name}` : `Downgrade to ${confirmTier.name}`;
              })()}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1">
                {isProrateLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Calculating prorated amount...
                  </div>
                ) : proratePreview ? (
                  <div className="space-y-2 text-sm">
                    {proratePreview.credit > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Current plan credit ({proratePreview.daysRemaining} days remaining)
                        </span>
                        <span className="font-medium text-green-600">
                          -{formatPrice(proratePreview.credit)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        New plan ({confirmBillingCycle.toLowerCase()})
                      </span>
                      <span>{formatPrice(proratePreview.newFullPrice)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>You pay today</span>
                      <span>{proratePreview.charge === 0 ? "Free" : formatPrice(proratePreview.charge)}</span>
                    </div>
                    {proratePreview.charge > 0 && (
                      <p className="text-xs text-muted-foreground">
                        New period: {formatDate(proratePreview.newPeriodStart)} → {formatDate(proratePreview.newPeriodEnd)}
                      </p>
                    )}
                    {proratePreview.charge === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Your credit covers the full cost. The change takes effect immediately.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {confirmTier && (confirmBillingCycle === "ANNUAL" ? confirmTier.annualPrice : confirmTier.monthlyPrice) === 0
                      ? `Switch to the Free plan immediately. No payment required.`
                      : `You will be charged for the ${confirmTier?.name} plan. The change takes effect immediately upon payment.`}
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTier(null)} disabled={isConfirming}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isConfirming || isProrateLoading}>
              {isConfirming
                ? "Processing..."
                : proratePreview?.charge === 0
                  ? "Switch Now (Free)"
                  : confirmTier && (confirmBillingCycle === "ANNUAL" ? confirmTier.annualPrice : confirmTier?.monthlyPrice) === 0
                    ? "Switch to Free"
                    : "Pay & Switch Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
