"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquareIcon } from "@hugeicons/core-free-icons";
import { formatDate, formatCurrency } from "@/lib/format";
import { toast } from "sonner";

type Lease = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  rentAmount: string;
  paymentCycle: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paidAt: string | null;
  depositAmount: string | null;
  depositStatus: string | null;
  isAutoRenew: boolean;
  autoRenewalNoticeDays: number | null;
  gracePeriodDays: number | null;
  unit: { name: string; property: { name: string } };
};

type Payment = {
  id: string;
  type: string;
  gateway: string;
  externalId: string | null;
  amount: string;
  status: string;
  paymentLinkUrl: string | null;
  receiptUrl: string | null;
  paidAt: string | null;
  createdAt: string;
};

function sortLeases(leases: Lease[]): Lease[] {
  return [...leases].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
}

export default function TenantLeasePage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const requestedLeaseId = useSearchParams().get("lease");

  useEffect(() => {
    fetch("/api/tenant/leases")
      .then((r) => r.json())
      .then((d: Lease[] | { data: Lease[] }) => {
        const leaseArray = Array.isArray(d)
          ? d
          : ((d as { data: Lease[] }).data ?? []);
        const sorted = sortLeases(leaseArray);
        setLeases(sorted);
        const target =
          (requestedLeaseId && sorted.find((l) => l.id === requestedLeaseId)) ??
          sorted.find((l) => l.status === "ACTIVE") ??
          sorted[0];
        if (target) setSelectedLeaseId(target.id);
      })
      .catch(() => toast.error("Failed to load leases."))
      .finally(() => setLoading(false));
  }, [requestedLeaseId]);

  useEffect(() => {
    if (!selectedLeaseId) return;
    setPayments([]);
    fetch(`/api/tenant/leases/${selectedLeaseId}/payments`)
      .then((r) => r.json())
      .then((d: Payment[]) => setPayments(d ?? []));
  }, [selectedLeaseId]);

  const selectedLease = leases.find((l) => l.id === selectedLeaseId);

  async function handlePayOnline() {
    if (!selectedLeaseId) return;
    setPayLoading(true);
    try {
      const res = await fetch(`/api/tenant/leases/${selectedLeaseId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        paymentLinkUrl?: string;
        error?: string;
      };
      if (data.paymentLinkUrl) {
        window.open(data.paymentLinkUrl, "_blank");
      } else {
        toast.error(data.error ?? "Failed to create payment link.");
      }
    } finally {
      setPayLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Lease & Payments</h1>

      {leases.length === 0 ? (
        <p className="text-muted-foreground">No leases found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_2fr] items-start">
          {/* Sidebar */}
          <div className="space-y-2">
            {leases.map((l) => {
              const isSelected = l.id === selectedLeaseId;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedLeaseId(l.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <p className="font-medium text-sm truncate">
                    {l.unit.property.name} — {l.unit.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(l.startDate)} → {formatDate(l.endDate)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {l.status}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="space-y-4">
            {selectedLease && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {selectedLease.unit.property.name} —{" "}
                    {selectedLease.unit.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{selectedLease.status}</dd>
                    <dt className="text-muted-foreground">Start date</dt>
                    <dd>{formatDate(selectedLease.startDate)}</dd>
                    <dt className="text-muted-foreground">End date</dt>
                    <dd>{formatDate(selectedLease.endDate)}</dd>
                    <dt className="text-muted-foreground">Rent</dt>
                    <dd>{formatCurrency(selectedLease.rentAmount)} / {selectedLease.paymentCycle.toLowerCase()}</dd>
                    <dt className="text-muted-foreground">Payment status</dt>
                    <dd>{selectedLease.paymentStatus}</dd>
                    <dt className="text-muted-foreground">Payment method</dt>
                    <dd>{selectedLease.paymentMethod ? selectedLease.paymentMethod.replace(/_/g, " ") : "—"}</dd>
                    <dt className="text-muted-foreground">Paid on</dt>
                    <dd>{selectedLease.paidAt ? formatDate(selectedLease.paidAt) : "—"}</dd>
                    <dt className="text-muted-foreground">Deposit</dt>
                    <dd>{formatCurrency(selectedLease.depositAmount ?? 0)}</dd>
                    <dt className="text-muted-foreground">Deposit status</dt>
                    <dd>{selectedLease.depositStatus ?? "—"}</dd>
                    <dt className="text-muted-foreground">Payment deadline</dt>
                    <dd>{selectedLease.gracePeriodDays != null ? (() => {
                      const d = new Date(selectedLease.startDate);
                      d.setDate(d.getDate() + selectedLease.gracePeriodDays!);
                      return formatDate(d);
                    })() : "—"}</dd>
                    <dt className="text-muted-foreground">Auto-renew</dt>
                    <dd>{selectedLease.isAutoRenew ? "Yes" : "No"}</dd>
                    <dt className="text-muted-foreground">Cancel by</dt>
                    <dd>{selectedLease.isAutoRenew && selectedLease.autoRenewalNoticeDays != null ? (() => {
                      const d = new Date(selectedLease.endDate);
                      d.setDate(d.getDate() - selectedLease.autoRenewalNoticeDays!);
                      return formatDate(d);
                    })() : "—"}</dd>
                  </dl>

                  {(selectedLease.status === "DRAFT" ||
                    selectedLease.status === "ACTIVE") &&
                    selectedLease.paymentStatus !== "COMPLETED" && (
                      <div className="mt-4">
                        <Button
                          onClick={handlePayOnline}
                          disabled={payLoading}
                          className="gap-2"
                        >
                          <HugeiconsIcon icon={LinkSquareIcon} size={15} />
                          {payLoading ? "Creating link…" : "Pay Online"}
                        </Button>
                      </div>
                    )}
                </CardContent>
              </Card>
            )}

            {/* Payment history */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No payments yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paid On</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Gateway</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">
                            {p.paidAt
                              ? formatDate(p.paidAt)
                              : formatDate(p.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {formatCurrency(p.amount)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.gateway}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {p.externalId?.startsWith("seed-manual-") ||
                            p.externalId?.startsWith("manual-")
                              ? "—"
                              : (p.externalId ?? "—")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.status}
                          </TableCell>
                          <TableCell>
                            {p.receiptUrl ? (
                              <a
                                href={p.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                              >
                                Download
                                <HugeiconsIcon
                                  icon={LinkSquareIcon}
                                  size={12}
                                />
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
