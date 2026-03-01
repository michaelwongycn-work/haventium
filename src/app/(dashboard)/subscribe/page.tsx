"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
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
} from "@/components/ui/dialog";

type TierType = "FREE" | "NORMAL" | "PRO";
type BillingCycle = "MONTHLY" | "ANNUAL";

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
  billingCycle: BillingCycle;
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

const TIER_ORDER: TierType[] = ["FREE", "NORMAL", "PRO"];

export default function SubscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentParam = searchParams.get("payment");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");

  // Modal state
  const [confirmTier, setConfirmTier] = useState<SubscriptionTier | null>(null);
  const [confirmBillingCycle, setConfirmBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [proratePreview, setProratePreview] = useState<ProratePreview | null>(null);
  const [isProrateLoading, setIsProrateLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

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
                    toast.error("Payment received but not yet confirmed. Please wait a moment and try again, or contact support.");
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
            setBillingCycle(sub.billingCycle ?? "MONTHLY");
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

  const fetchProratePreview = useCallback(async (tierId: string, cycle: BillingCycle) => {
    setIsProrateLoading(true);
    setProratePreview(null);
    try {
      const res = await fetch(`/api/subscribe/prorate?tierId=${tierId}&billingCycle=${cycle}`);
      if (res.ok) {
        const data = await res.json();
        setProratePreview(data);
      }
    } catch {
      // ignore
    } finally {
      setIsProrateLoading(false);
    }
  }, []);

  const handleSelectTier = (tier: SubscriptionTier) => {
    if (!subscription) return;
    if (tier.id === subscription.tierId && subscription.status === "ACTIVE" && billingCycle === subscription.billingCycle) return;

    setConfirmTier(tier);
    setConfirmBillingCycle(billingCycle);

    if (subscription.status === "ACTIVE" && tier.monthlyPrice > 0) {
      fetchProratePreview(tier.id, billingCycle);
    }
  };

  const handleModalBillingChange = (cycle: BillingCycle) => {
    setConfirmBillingCycle(cycle);
    if (confirmTier && subscription?.status === "ACTIVE" && confirmTier.monthlyPrice > 0) {
      fetchProratePreview(confirmTier.id, cycle);
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Confirming Payment...</CardTitle>
            <p className="text-sm text-muted-foreground">Please wait while we verify your payment.</p>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoading && subscription && (subscription.status === "PENDING_PAYMENT" || subscription.status === "EXPIRED")) {
    const isExpired = subscription.status === "EXPIRED";
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{isExpired ? "Subscription Expired" : "Complete Your Subscription"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isExpired
                ? "Your subscription has expired. Renew now to restore full access. Your data is safe and intact."
                : "Your subscription payment is pending. Complete payment to access all features."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={handleRenew} disabled={isConfirming}>
              {isConfirming ? "Loading..." : isExpired ? "Renew Subscription" : "Pay Now"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              You will be redirected to a secure Xendit payment page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const annualDiscount = (tier: SubscriptionTier) => {
    if (tier.monthlyPrice === 0) return null;
    const saving = Math.round((1 - tier.annualPrice / (tier.monthlyPrice * 12)) * 100);
    return saving > 0 ? saving : null;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Current plan summary */}
      {subscription && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border bg-muted/40 px-5 py-4 text-sm">
          <div>
            <span className="text-muted-foreground">Plan </span>
            <span className="font-medium">{subscription.tier?.name ?? "Unknown"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Status </span>
            <span className="font-medium capitalize">{subscription.status.toLowerCase().replace("_", " ")}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Billing </span>
            <span className="font-medium capitalize">{subscription.billingCycle.toLowerCase()}</span>
          </div>
          {subscription.endDate && subscription.tier?.type !== "FREE" && (
            <div>
              <span className="text-muted-foreground">Renews </span>
              <span className="font-medium">{formatDate(subscription.endDate)}</span>
            </div>
          )}
        </div>
      )}

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Available Plans</h2>
        <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
          <button
            onClick={() => setBillingCycle("MONTHLY")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              billingCycle === "MONTHLY"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("ANNUAL")}
            className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              billingCycle === "ANNUAL"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual
            <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
              Save
            </span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {tiers.map((tier) => {
          const isCurrent =
            subscription?.tierId === tier.id &&
            subscription?.status === "ACTIVE" &&
            subscription?.billingCycle === billingCycle;
          const isCurrentTierDifferentCycle =
            subscription?.tierId === tier.id &&
            subscription?.status === "ACTIVE" &&
            subscription?.billingCycle !== billingCycle;
          const price = billingCycle === "ANNUAL" ? tier.annualPrice : tier.monthlyPrice;
          const saving = billingCycle === "ANNUAL" ? annualDiscount(tier) : null;

          let actionLabel = "Select";
          let actionVariant: "default" | "outline" | "secondary" = "default";
          let actionDisabled = false;

          if (isCurrent) {
            actionLabel = "Current Plan";
            actionVariant = "secondary";
            actionDisabled = true;
          } else if (isCurrentTierDifferentCycle) {
            actionLabel = `Switch to ${billingCycle === "ANNUAL" ? "Annual" : "Monthly"}`;
            actionVariant = "default";
          } else if (subscription) {
            const currentIdx = TIER_ORDER.indexOf(subscription.tier?.type as TierType ?? "FREE");
            const targetIdx = TIER_ORDER.indexOf(tier.type);
            actionLabel = targetIdx > currentIdx ? "Upgrade" : "Downgrade";
            actionVariant = targetIdx > currentIdx ? "default" : "outline";
          }

          return (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}
            >
              {isCurrent && (
                <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                  Current
                </span>
              )}
              <CardHeader className="pb-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tier.name}</p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold">{formatPrice(price)}</span>
                  {tier.monthlyPrice > 0 && (
                    <span className="mb-0.5 text-sm text-muted-foreground">
                      /{billingCycle === "ANNUAL" ? "yr" : "bln"}
                    </span>
                  )}
                </div>
                {saving && (
                  <p className="text-xs text-green-600 font-medium">Save {saving}% vs monthly</p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>{tier.maxUsers} users</li>
                  <li>{tier.maxProperties} properties</li>
                  <li>{tier.maxUnits} units</li>
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <span className="text-primary">✓</span> {f}
                    </li>
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

      {/* Confirmation modal */}
      <Dialog open={!!confirmTier} onOpenChange={(open) => !open && setConfirmTier(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {(() => {
                if (!subscription || !confirmTier) return "Change Plan";
                const currentIdx = TIER_ORDER.indexOf(subscription.tier?.type as TierType ?? "FREE");
                const targetIdx = TIER_ORDER.indexOf(confirmTier.type);
                if (confirmTier.monthlyPrice === 0) return `Switch to ${confirmTier.name}`;
                return targetIdx > currentIdx ? `Upgrade to ${confirmTier.name}` : `Downgrade to ${confirmTier.name}`;
              })()}
            </DialogTitle>
          </DialogHeader>

          <DialogDescription asChild>
            <div className="space-y-4">
              {/* Billing cycle picker in modal */}
              {confirmTier && confirmTier.monthlyPrice > 0 && (
                <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
                  <button
                    onClick={() => handleModalBillingChange("MONTHLY")}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                      confirmBillingCycle === "MONTHLY"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => handleModalBillingChange("ANNUAL")}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                      confirmBillingCycle === "ANNUAL"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Annual
                    {confirmTier && annualDiscount(confirmTier) && (
                      <span className="ml-1 text-[10px] text-green-600">
                        -{annualDiscount(confirmTier)}%
                      </span>
                    )}
                  </button>
                </div>
              )}

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
                        Credit ({proratePreview.daysRemaining}d remaining)
                      </span>
                      <span className="font-medium text-green-600">
                        -{formatPrice(proratePreview.credit)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New plan</span>
                    <span>{formatPrice(proratePreview.newFullPrice)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>You pay today</span>
                    <span>{proratePreview.charge === 0 ? "Free" : formatPrice(proratePreview.charge)}</span>
                  </div>
                  {proratePreview.charge > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Period: {formatDate(proratePreview.newPeriodStart)} – {formatDate(proratePreview.newPeriodEnd)}
                    </p>
                  )}
                  {proratePreview.charge === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Your credit covers the full cost. Change takes effect immediately.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {confirmTier && (confirmBillingCycle === "ANNUAL" ? confirmTier.annualPrice : confirmTier.monthlyPrice) === 0
                    ? "Switch to the Free plan immediately. No payment required."
                    : `You will be charged for the ${confirmTier?.name} plan (${confirmBillingCycle.toLowerCase()}). Change takes effect immediately upon payment.`}
                </p>
              )}
            </div>
          </DialogDescription>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTier(null)} disabled={isConfirming}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isConfirming || isProrateLoading}>
              {isConfirming
                ? "Processing..."
                : proratePreview?.charge === 0
                  ? "Switch Now (Free)"
                  : confirmTier && (confirmBillingCycle === "ANNUAL" ? confirmTier.annualPrice : confirmTier.monthlyPrice) === 0
                    ? "Switch to Free"
                    : "Pay & Switch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
