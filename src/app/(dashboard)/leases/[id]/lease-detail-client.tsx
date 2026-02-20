"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentList } from "@/components/document-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  File01Icon,
  Cancel01Icon,
  UserIcon,
  Home01Icon,
  Layers01Icon,
  CreditCardIcon,
  ShieldEnergyIcon,
  Notification01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { formatDate, formatCurrency } from "@/lib/format";

const ACTIVITY_ICON_MAP: Record<string, typeof File01Icon> = {
  LEASE_CREATED: File01Icon,
  LEASE_UPDATED: File01Icon,
  LEASE_TERMINATED: Cancel01Icon,
  TENANT_CREATED: UserIcon,
  TENANT_UPDATED: UserIcon,
  TENANT_STATUS_CHANGED: UserIcon,
  PROPERTY_CREATED: Home01Icon,
  PROPERTY_UPDATED: Home01Icon,
  UNIT_CREATED: Layers01Icon,
  UNIT_UPDATED: Layers01Icon,
  PAYMENT_RECORDED: CreditCardIcon,
  PAYMENT_UPDATED: CreditCardIcon,
  DEPOSIT_CREATED: ShieldEnergyIcon,
  DEPOSIT_RETURNED: ShieldEnergyIcon,
  NOTIFICATION_SENT: Notification01Icon,
  USER_LOGIN: UserIcon,
  OTHER: MoreHorizontalIcon,
};

const ACTIVITY_COLOR_MAP: Record<string, string> = {
  LEASE_CREATED: "text-blue-500",
  LEASE_UPDATED: "text-blue-500",
  LEASE_TERMINATED: "text-blue-500",
  TENANT_CREATED: "text-violet-500",
  TENANT_UPDATED: "text-violet-500",
  TENANT_STATUS_CHANGED: "text-violet-500",
  PROPERTY_CREATED: "text-emerald-500",
  PROPERTY_UPDATED: "text-emerald-500",
  UNIT_CREATED: "text-emerald-500",
  UNIT_UPDATED: "text-emerald-500",
  PAYMENT_RECORDED: "text-amber-500",
  PAYMENT_UPDATED: "text-amber-500",
  DEPOSIT_CREATED: "text-amber-500",
  DEPOSIT_RETURNED: "text-amber-500",
  NOTIFICATION_SENT: "text-blue-500",
  USER_LOGIN: "text-violet-500",
  OTHER: "text-muted-foreground",
};

const ACTIVITY_BG_MAP: Record<string, string> = {
  LEASE_CREATED: "bg-blue-500/10",
  LEASE_UPDATED: "bg-blue-500/10",
  LEASE_TERMINATED: "bg-blue-500/10",
  TENANT_CREATED: "bg-violet-500/10",
  TENANT_UPDATED: "bg-violet-500/10",
  TENANT_STATUS_CHANGED: "bg-violet-500/10",
  PROPERTY_CREATED: "bg-emerald-500/10",
  PROPERTY_UPDATED: "bg-emerald-500/10",
  UNIT_CREATED: "bg-emerald-500/10",
  UNIT_UPDATED: "bg-emerald-500/10",
  PAYMENT_RECORDED: "bg-amber-500/10",
  PAYMENT_UPDATED: "bg-amber-500/10",
  DEPOSIT_CREATED: "bg-amber-500/10",
  DEPOSIT_RETURNED: "bg-amber-500/10",
  NOTIFICATION_SENT: "bg-blue-500/10",
  USER_LOGIN: "bg-violet-500/10",
  OTHER: "bg-muted",
};

type LeaseStatus = "DRAFT" | "ACTIVE" | "ENDED";
type PaymentCycle = "DAILY" | "MONTHLY" | "ANNUAL";
type DepositStatus = "HELD" | "RETURNED" | "FORFEITED";
type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "VIRTUAL_ACCOUNT"
  | "QRIS"
  | "MANUAL";

type Lease = {
  id: string;
  startDate: string;
  endDate: string;
  paymentCycle: PaymentCycle;
  rentAmount: string | null;
  gracePeriodDays: number | null;
  isAutoRenew: boolean;
  autoRenewalNoticeDays: number | null;
  depositAmount: string | null;
  depositStatus: DepositStatus | null;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  status: LeaseStatus;
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };
  unit: {
    id: string;
    name: string;
    property: {
      id: string;
      name: string;
    };
  };
  renewedFrom: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  renewedTo: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
    user: {
      name: string;
      email: string;
    } | null;
  }>;
};

export default function LeaseDetailClient({
  params,
}: {
  params: { id: string };
}) {
  const [lease, setLease] = useState<Lease | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaseId, setLeaseId] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [isAutoRenewEditing, setIsAutoRenewEditing] = useState(false);
  const [autoRenewForm, setAutoRenewForm] = useState({
    isAutoRenew: false,
    gracePeriodDays: 3,
    autoRenewalNoticeDays: 5,
  });
  const [isDepositEditing, setIsDepositEditing] = useState(false);
  const [isNoticePeriodAlertOpen, setIsNoticePeriodAlertOpen] = useState(false);
  const [isFutureLeaseAlertOpen, setIsFutureLeaseAlertOpen] = useState(false);
  const [depositStatusForm, setDepositStatusForm] =
    useState<DepositStatus>("HELD");

  // Payment link state
  const [paymentTransactions, setPaymentTransactions] = useState<
    Array<{
      id: string;
      status: string;
      paymentLinkUrl: string | null;
      receiptUrl: string | null;
      paidAt: string | null;
      amount: string;
    }>
  >([]);
  const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState(false);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);

  useEffect(() => {
    Promise.resolve(params).then((resolvedParams) => {
      setLeaseId(resolvedParams.id);
    });
  }, [params]);

  const fetchLease = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/leases/${leaseId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch lease");
      }

      const data = await response.json();
      setLease(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lease");
    } finally {
      setIsLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    if (leaseId) {
      fetchLease();
    }
  }, [leaseId, fetchLease]);

  useEffect(() => {
    if (!leaseId) return;
    const fetchPayments = async () => {
      try {
        const res = await fetch(`/api/leases/${leaseId}/payments`);
        if (res.ok) {
          const data = await res.json();
          setPaymentTransactions(data.items ?? []);
        }
      } catch {
        // ignore
      }
    };
    fetchPayments();
  }, [leaseId]);

  const handleCreatePaymentLink = async () => {
    if (!leaseId) return;
    setIsCreatingPaymentLink(true);
    try {
      const res = await fetch(`/api/leases/${leaseId}/create-payment-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create payment link");
        return;
      }
      // Refresh transactions
      const txRes = await fetch(`/api/leases/${leaseId}/payments`);
      if (txRes.ok) {
        const txData = await txRes.json();
        setPaymentTransactions(txData.items ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment link");
    } finally {
      setIsCreatingPaymentLink(false);
    }
  };

  const handleCopyPaymentLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 2000);
    });
  };

  const getDaysRemaining = () => {
    if (!lease) return 0;
    const today = new Date();
    const endDate = new Date(lease.endDate);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getLastCancellationDate = () => {
    if (!lease || !lease.isAutoRenew || !lease.autoRenewalNoticeDays)
      return null;
    const endDate = new Date(lease.endDate);
    endDate.setDate(endDate.getDate() - lease.autoRenewalNoticeDays);
    return endDate;
  };

  const getLastPaymentDate = () => {
    if (!lease || !lease.gracePeriodDays) return null;
    const endDate = new Date(lease.endDate);
    endDate.setDate(endDate.getDate() + lease.gracePeriodDays);
    return endDate;
  };

  const isNoticePeriodPassed = () => {
    if (
      !lease ||
      !lease.isAutoRenew ||
      !lease.autoRenewalNoticeDays ||
      lease.status !== "ACTIVE"
    )
      return false;
    const deadline = new Date(lease.endDate);
    deadline.setDate(deadline.getDate() - lease.autoRenewalNoticeDays);
    return new Date() >= deadline;
  };

  const [hasFutureLeaseOnUnit, setHasFutureLeaseOnUnit] = useState(false);

  useEffect(() => {
    if (!lease || lease.status !== "ACTIVE") {
      setHasFutureLeaseOnUnit(false);
      return;
    }
    const checkFutureLeases = async () => {
      try {
        const response = await fetch(
          `/api/leases/${leaseId}/check-future-lease`,
        );
        if (response.ok) {
          const data = await response.json();
          setHasFutureLeaseOnUnit(data.hasFutureLease);
        }
      } catch {
        // ignore
      }
    };
    checkFutureLeases();
  }, [lease, leaseId]);

  const handleOpenPaymentDialog = () => {
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("CASH");
    setIsPaymentDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!lease || !paymentDate || !paymentMethod) return;

    // Validate payment date is not in the future
    const selectedDate = new Date(paymentDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today

    if (selectedDate > today) {
      setError("Payment date cannot be in the future");
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/leases/${leaseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paidAt: new Date(paymentDate).toISOString(),
          paymentMethod: paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to record payment");
      }

      await fetchLease();
      setIsPaymentDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditAutoRenewal = () => {
    if (!lease) return;
    if (lease.isAutoRenew && isNoticePeriodPassed()) {
      setIsNoticePeriodAlertOpen(true);
      return;
    }
    if (!lease.isAutoRenew && hasFutureLeaseOnUnit) {
      setIsFutureLeaseAlertOpen(true);
      return;
    }
    setAutoRenewForm({
      isAutoRenew: lease.isAutoRenew,
      gracePeriodDays: lease.gracePeriodDays || 3,
      autoRenewalNoticeDays: lease.autoRenewalNoticeDays || 5,
    });
    setIsAutoRenewEditing(true);
  };

  const handleSaveAutoRenewal = async () => {
    if (!lease) return;
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/leases/${leaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isAutoRenew: autoRenewForm.isAutoRenew,
          gracePeriodDays: autoRenewForm.isAutoRenew
            ? autoRenewForm.gracePeriodDays
            : null,
          autoRenewalNoticeDays: autoRenewForm.isAutoRenew
            ? autoRenewForm.autoRenewalNoticeDays
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update auto-renewal");
      }

      await fetchLease();
      setIsAutoRenewEditing(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update auto-renewal",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditDepositStatus = () => {
    if (!lease) return;
    setDepositStatusForm(lease.depositStatus || "HELD");
    setIsDepositEditing(true);
  };

  const handleSaveDepositStatus = async () => {
    if (!lease) return;
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/leases/${leaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositStatus: depositStatusForm }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update deposit status");
      }

      await fetchLease();
      setIsDepositEditing(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update deposit status",
      );
    } finally {
      setIsUpdating(false);
    }
  };


  const formatPaymentMethod = (method: PaymentMethod | null) => {
    if (!method) return "—";
    const methods: Record<PaymentMethod, string> = {
      CASH: "Cash",
      BANK_TRANSFER: "Bank Transfer",
      VIRTUAL_ACCOUNT: "Virtual Account",
      QRIS: "QRIS",
      MANUAL: "Manual",
    };
    return methods[method] || method;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  if (!lease && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Lease not found</h2>
          <p className="text-muted-foreground mb-6">
            {"The lease you're looking for doesn't exist"}
          </p>
          <Button asChild>
            <Link href="/leases">
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Back to Leases
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/leases">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {lease?.tenant.fullName || "Loading..."}
          </h1>
          <p className="text-muted-foreground mt-1">Lease agreement details</p>
        </div>
        {lease && lease.status === "ACTIVE" && daysRemaining > 0 && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Days Remaining</p>
            <p className="text-2xl font-bold">{daysRemaining}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[200px]" />
              <Skeleton className="h-4 w-[350px]" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-[80px] mb-2" />
                    <Skeleton className="h-5 w-[120px]" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[250px]" />
              <Skeleton className="h-4 w-[300px]" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-[80px] mb-2" />
                    <Skeleton className="h-5 w-[100px]" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[280px]" />
              <Skeleton className="h-4 w-[250px]" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-[80px] mb-2" />
                    <Skeleton className="h-5 w-[100px]" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[150px]" />
              <Skeleton className="h-4 w-[280px]" />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 pt-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-[200px] mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Lease Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Lease Information</CardTitle>
              <CardDescription>
                Complete details about this lease agreement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main lease info in one row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tenant</p>
                  <Link
                    href={`/tenants/${lease?.tenant.id}`}
                    className="font-medium hover:underline"
                  >
                    {lease?.tenant.fullName}
                  </Link>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Property / Unit
                  </p>
                  <Link
                    href={`/properties/${lease?.unit.property.id}/units/${lease?.unit.id}`}
                    className="font-medium hover:underline"
                  >
                    {lease?.unit.property.name} / {lease?.unit.name}
                  </Link>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Rent Amount
                  </p>
                  <p className="font-bold">
                    {formatCurrency(lease?.rentAmount)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Payment Cycle
                  </p>
                  <p className="font-medium capitalize">
                    {lease?.paymentCycle.toLowerCase()}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className="font-medium capitalize">
                    {lease?.status.toLowerCase()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lease Period & Renewal Information */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Lease Period & Renewal</CardTitle>
                <CardDescription>
                  Lease duration and auto-renewal settings
                </CardDescription>
              </div>
              {lease?.status !== "ENDED" && (
                <div>
                  {isAutoRenewEditing ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveAutoRenewal}
                        disabled={isUpdating}
                      >
                        {isUpdating ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsAutoRenewEditing(false)}
                        disabled={isUpdating}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditAutoRenewal}
                    >
                      Edit Auto-Renewal
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Start Date */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Start Date
                  </p>
                  <p className="font-medium">
                    {lease?.startDate ? formatDate(lease.startDate) : "—"}
                  </p>
                </div>

                {/* End Date */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">End Date</p>
                  <p className="font-medium">
                    {lease?.endDate ? formatDate(lease.endDate) : "—"}
                  </p>
                </div>

                {/* Is Renewable */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Auto-Renewal
                  </p>
                  {isAutoRenewEditing ? (
                    <div>
                      <Switch
                        checked={autoRenewForm.isAutoRenew}
                        onCheckedChange={(checked) =>
                          setAutoRenewForm({
                            ...autoRenewForm,
                            isAutoRenew: checked,
                          })
                        }
                        disabled={
                          isUpdating ||
                          (lease?.isAutoRenew && isNoticePeriodPassed()) ||
                          (!lease?.isAutoRenew && hasFutureLeaseOnUnit)
                        }
                      />
                      {lease?.isAutoRenew && isNoticePeriodPassed() && (
                        <p className="text-xs text-destructive mt-1">
                          Notice period has passed
                        </p>
                      )}
                      {!lease?.isAutoRenew && hasFutureLeaseOnUnit && (
                        <p className="text-xs text-destructive mt-1">
                          Unit has a future lease
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium">
                      {lease?.isAutoRenew ? "Yes" : "No"}
                    </p>
                  )}
                </div>

                {/* Grace Period */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Grace Period
                  </p>
                  {isAutoRenewEditing ? (
                    autoRenewForm.isAutoRenew ? (
                      <Input
                        type="number"
                        min="0"
                        value={autoRenewForm.gracePeriodDays}
                        onChange={(e) =>
                          setAutoRenewForm({
                            ...autoRenewForm,
                            gracePeriodDays: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={isUpdating}
                        className="h-8"
                      />
                    ) : (
                      <p className="font-medium text-muted-foreground">—</p>
                    )
                  ) : (
                    <p className="font-medium">
                      {(() => {
                        const lastPaymentDate = getLastPaymentDate();
                        return lease?.isAutoRenew && lastPaymentDate
                          ? `${formatDate(lastPaymentDate.toISOString())} | ${lease.gracePeriodDays} days`
                          : lease?.gracePeriodDays
                            ? `${lease.gracePeriodDays} days`
                            : "—";
                      })()}
                    </p>
                  )}
                </div>

                {/* Notice Period */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Notice Period
                  </p>
                  {isAutoRenewEditing ? (
                    autoRenewForm.isAutoRenew ? (
                      <Input
                        type="number"
                        min="1"
                        value={autoRenewForm.autoRenewalNoticeDays}
                        onChange={(e) =>
                          setAutoRenewForm({
                            ...autoRenewForm,
                            autoRenewalNoticeDays:
                              parseInt(e.target.value) || 1,
                          })
                        }
                        disabled={isUpdating}
                        className="h-8"
                      />
                    ) : (
                      <p className="font-medium text-muted-foreground">—</p>
                    )
                  ) : (
                    <p className="font-medium">
                      {(() => {
                        const lastCancellationDate = getLastCancellationDate();
                        return lease?.isAutoRenew && lastCancellationDate
                          ? `${formatDate(lastCancellationDate.toISOString())} | ${lease.autoRenewalNoticeDays} days`
                          : lease?.autoRenewalNoticeDays
                            ? `${lease.autoRenewalNoticeDays} days`
                            : "—";
                      })()}
                    </p>
                  )}
                </div>
              </div>

              {/* Renewal Chain */}
              {(lease?.renewedFrom || lease?.renewedTo) && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Renewal Chain
                  </p>
                  <div className="flex flex-col gap-2">
                    {lease.renewedFrom && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Previous lease:
                        </span>
                        <Link
                          href={`/leases/${lease.renewedFrom.id}`}
                          className="font-medium hover:underline"
                        >
                          {formatDate(lease.renewedFrom.startDate)} –{" "}
                          {formatDate(lease.renewedFrom.endDate)}
                        </Link>
                        <span className="text-xs text-muted-foreground capitalize">
                          ({lease.renewedFrom.status.toLowerCase()})
                        </span>
                      </div>
                    )}
                    {lease.renewedTo && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Next lease:
                        </span>
                        <Link
                          href={`/leases/${lease.renewedTo.id}`}
                          className="font-medium hover:underline"
                        >
                          {formatDate(lease.renewedTo.startDate)} –{" "}
                          {formatDate(lease.renewedTo.endDate)}
                        </Link>
                        <span className="text-xs text-muted-foreground capitalize">
                          ({lease.renewedTo.status.toLowerCase()})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deposit & Payment Information */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Deposit & Payment Information</CardTitle>
                <CardDescription>
                  Security deposit and payment status
                </CardDescription>
              </div>
              {lease?.status === "ENDED" &&
                !lease?.renewedTo &&
                lease?.depositAmount &&
                (!lease.depositStatus || lease.depositStatus === "HELD") && (
                  <div>
                    {isDepositEditing ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveDepositStatus}
                          disabled={isUpdating}
                        >
                          {isUpdating ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsDepositEditing(false)}
                          disabled={isUpdating}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEditDepositStatus}
                      >
                        Edit Deposit Status
                      </Button>
                    )}
                  </div>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Deposit Amount */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Deposit Amount
                  </p>
                  <p className="font-bold">
                    {lease?.depositAmount
                      ? formatCurrency(lease.depositAmount)
                      : "—"}
                  </p>
                </div>

                {/* Deposit Status */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Deposit Status
                  </p>
                  {isDepositEditing ? (
                    <Select
                      value={depositStatusForm}
                      onValueChange={(value) =>
                        setDepositStatusForm(value as DepositStatus)
                      }
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HELD">Held</SelectItem>
                        <SelectItem value="RETURNED">Returned</SelectItem>
                        <SelectItem value="FORFEITED">Forfeited</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium capitalize">
                      {lease?.depositAmount
                        ? lease.depositStatus?.toLowerCase() || "held"
                        : "—"}
                    </p>
                  )}
                </div>

                {/* Payment Status */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Payment Status
                  </p>
                  <p className="font-medium">
                    {lease?.paidAt ? "Paid" : "Unpaid"}
                  </p>
                </div>

                {/* Payment Date */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Payment Date
                  </p>
                  <p className="font-medium">
                    {lease?.paidAt ? formatDate(lease.paidAt) : "—"}
                  </p>
                </div>

                {/* Payment Method */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Payment Method
                  </p>
                  <p className="font-medium">
                    {formatPaymentMethod(lease?.paymentMethod || null)}
                  </p>
                </div>
              </div>

              {/* Mark as Paid Button */}
              {!lease?.paidAt && lease?.status === "DRAFT" && (
                <Button
                  onClick={handleOpenPaymentDialog}
                  disabled={isUpdating}
                  className="w-full"
                >
                  Mark as Paid
                </Button>
              )}

              {/* Xendit Payment Link Section */}
              {(() => {
                const pending = paymentTransactions.find(
                  (t) => t.status === "PENDING",
                );
                const completed = paymentTransactions.find(
                  (t) => t.status === "COMPLETED",
                );

                if (completed?.receiptUrl) {
                  return (
                    <div className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-medium">Payment Receipt</p>
                      <a
                        href={completed.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Download Receipt (PDF)
                      </a>
                    </div>
                  );
                }

                if (pending?.paymentLinkUrl) {
                  return (
                    <div className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-medium">Payment Link</p>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={pending.paymentLinkUrl}
                          className="text-xs h-8"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleCopyPaymentLink(pending.paymentLinkUrl!)
                          }
                        >
                          {paymentLinkCopied ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                      {lease?.tenant?.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const msg = `Halo ${lease.tenant.fullName},\n\nLink pembayaran sewa:\n${pending.paymentLinkUrl}\n\nTerima kasih.`;
                            window.open(
                              `https://wa.me/${lease.tenant.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
                              "_blank",
                            );
                          }}
                        >
                          Send via WhatsApp
                        </Button>
                      )}
                    </div>
                  );
                }

                if (!lease?.paidAt && lease?.status === "DRAFT") {
                  return (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleCreatePaymentLink}
                      disabled={isCreatingPaymentLink}
                    >
                      {isCreatingPaymentLink
                        ? "Creating Link..."
                        : "Create Payment Link (Xendit)"}
                    </Button>
                  );
                }

                return null;
              })()}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardContent className="pt-6">
              <DocumentList entityType="lease" entityId={params.id} />
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Recent activity related to this lease
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!lease?.activities || lease.activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No activity yet
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-0">
                    {lease.activities.map((activity) => {
                      const IconComponent =
                        ACTIVITY_ICON_MAP[activity.type] || MoreHorizontalIcon;
                      const colorClass =
                        ACTIVITY_COLOR_MAP[activity.type] ||
                        "text-muted-foreground";
                      const bgClass =
                        ACTIVITY_BG_MAP[activity.type] || "bg-muted";

                      return (
                        <div
                          key={activity.id}
                          className="relative flex gap-3 pb-6 last:pb-0"
                        >
                          <div
                            className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bgClass}`}
                          >
                            <HugeiconsIcon
                              icon={IconComponent}
                              strokeWidth={2}
                              className={`h-4 w-4 ${colorClass}`}
                            />
                          </div>
                          <div className="flex-1 pt-1">
                            <p className="text-sm leading-relaxed">
                              {activity.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <p className="text-xs text-muted-foreground">
                                {formatRelativeTime(activity.createdAt)}
                              </p>
                              {activity.user && (
                                <p className="text-xs text-muted-foreground">
                                  by{" "}
                                  <span className="font-medium">
                                    {activity.user.name}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Enter the payment date for this lease
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment-date">Payment Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={isUpdating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(value as PaymentMethod)
                }
                disabled={isUpdating}
              >
                <SelectTrigger id="payment-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="VIRTUAL_ACCOUNT">
                    Virtual Account
                  </SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Lease Details:</p>
              <p className="text-muted-foreground">
                Tenant: {lease?.tenant.fullName}
              </p>
              <p className="text-muted-foreground">
                Amount: {formatCurrency(lease?.rentAmount)}
              </p>
              <p className="text-muted-foreground capitalize">
                Cycle: {lease?.paymentCycle.toLowerCase()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsPaymentDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={isUpdating || !paymentDate}
            >
              {isUpdating ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notice Period Passed Alert */}
      <AlertDialog
        open={isNoticePeriodAlertOpen}
        onOpenChange={setIsNoticePeriodAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Modify Auto-Renewal</AlertDialogTitle>
            <AlertDialogDescription>
              The notice period has already passed. Auto-renewal can no longer
              be disabled for this lease.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setIsNoticePeriodAlertOpen(false)}
            >
              Understood
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Future Lease Alert */}
      <AlertDialog
        open={isFutureLeaseAlertOpen}
        onOpenChange={setIsFutureLeaseAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Enable Auto-Renewal</AlertDialogTitle>
            <AlertDialogDescription>
              This unit already has a future lease scheduled. Auto-renewal
              cannot be enabled while another lease exists for this unit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsFutureLeaseAlertOpen(false)}>
              Understood
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
