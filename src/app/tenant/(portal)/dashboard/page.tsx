"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { Home04Icon, Calendar01Icon, Money01Icon, ToolsIcon, FileAttachmentIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/format";
import { toast } from "sonner";

type LeaseAgreement = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  rentAmount: string;
  paymentCycle: string;
  paymentStatus: string;
  depositAmount: string | null;
  depositStatus: string | null;
  unit: {
    id: string;
    name: string;
    property: { id: string; name: string };
  };
};

type TenantMe = {
  id: string;
  fullName: string;
  status: string;
  leaseAgreements: LeaseAgreement[];
};

type MaintenanceRequest = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Document = {
  id: string;
  filename: string;
  createdAt: string;
  property: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  lease: { id: string; startDate: string; endDate: string } | null;
};

export default function TenantDashboardPage() {
  const [data, setData] = useState<TenantMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [allLeases, setAllLeases] = useState<LeaseAgreement[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    fetch("/api/tenant/me")
      .then((r) => r.json())
      .then((d: TenantMe) => setData(d))
      .catch(() => toast.error("Failed to load profile."))
      .finally(() => setLoading(false));

    fetch("/api/tenant/leases")
      .then((r) => r.json())
      .then((d) => setAllLeases(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => toast.error("Failed to load leases."));

    fetch("/api/tenant/maintenance-requests")
      .then((r) => r.json())
      .then((d) => setMaintenanceRequests(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => toast.error("Failed to load maintenance requests."));

    fetch("/api/tenant/documents")
      .then((r) => r.json())
      .then((d) => setDocuments(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => toast.error("Failed to load documents."));
  }, []);

  const activeLease = data?.leaseAgreements[0];
  const draftLeases = allLeases.filter((l) => l.status === "DRAFT");
  const leaseHistory = allLeases.slice(0, 5);
  const openRequests = maintenanceRequests
    .filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS")
    .slice(0, 5);
  const recentDocs = documents.slice(0, 5);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {loading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            `Welcome, ${data?.fullName?.split(" ")[0]}`
          )}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here&apos;s an overview of your tenancy.
        </p>
      </div>

      {/* Pending Lease Alert */}
      {!loading && draftLeases.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 p-3 text-sm flex items-center justify-between">
          <span className="text-yellow-800 dark:text-yellow-300">
            {draftLeases.length === 1
              ? "You have a lease pending payment."
              : `You have ${draftLeases.length} leases pending payment.`}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href={`/tenant/lease?lease=${draftLeases[0].id}`}>View</Link>
          </Button>
        </div>
      )}

      {/* Active Lease Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HugeiconsIcon icon={Home04Icon} size={16} />
            Active Lease
          </CardTitle>
          <CardDescription>Your current rental</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : activeLease ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
              <div className="flex justify-between sm:flex-col sm:gap-0.5">
                <span className="text-muted-foreground">Unit</span>
                <span className="font-medium">
                  {activeLease.unit.property.name} — {activeLease.unit.name}
                </span>
              </div>
              <div className="flex justify-between sm:flex-col sm:gap-0.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  <HugeiconsIcon icon={Calendar01Icon} size={13} />
                  Period
                </span>
                <span className="font-medium text-xs">
                  {formatDate(activeLease.startDate)} —{" "}
                  {formatDate(activeLease.endDate)}
                </span>
              </div>
              <div className="flex justify-between sm:flex-col sm:gap-0.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  <HugeiconsIcon icon={Money01Icon} size={13} />
                  Rent
                </span>
                <span className="font-medium">
                  {formatCurrency(activeLease.rentAmount)} /{" "}
                  {activeLease.paymentCycle.toLowerCase()}
                </span>
              </div>
              <div className="flex justify-between sm:flex-col sm:gap-0.5">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-medium">{activeLease.paymentStatus}</span>
              </div>
              {activeLease.depositAmount && (
                <div className="flex justify-between sm:flex-col sm:gap-0.5">
                  <span className="text-muted-foreground">Deposit</span>
                  <span className="font-medium">
                    {formatCurrency(activeLease.depositAmount)} · {activeLease.depositStatus}
                  </span>
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-3 pt-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/tenant/lease?lease=${activeLease.id}`}>View lease details</Link>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No active lease found.</p>
          )}
        </CardContent>
      </Card>

      {/* Lease History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HugeiconsIcon icon={FileAttachmentIcon} size={16} />
            Lease History
          </CardTitle>
          <CardDescription>Previous and pending leases</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {leaseHistory.length > 0 ? (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Unit</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Period</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Rent</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Status</th>
                      <th className="text-left font-medium text-muted-foreground pb-2">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaseHistory.map((lease) => (
                      <tr key={lease.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-4 font-medium">
                          <Link href={`/tenant/lease?lease=${lease.id}`} className="hover:underline">
                            {lease.unit.property.name} — {lease.unit.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground text-xs">
                          {formatDate(lease.startDate)} —{" "}
                          {formatDate(lease.endDate)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatCurrency(lease.rentAmount)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{lease.status}</td>
                        <td className="py-2 text-muted-foreground">{lease.paymentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-2">
                <Link href="/tenant/lease" className="text-xs text-muted-foreground hover:underline">
                  View all →
                </Link>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No previous leases.</p>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Requests Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HugeiconsIcon icon={ToolsIcon} size={16} />
            Maintenance
          </CardTitle>
          <CardDescription>Open requests</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {openRequests.length > 0 ? (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Title</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Status</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Submitted</th>
                      <th className="text-left font-medium text-muted-foreground pb-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {openRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-4">
                          <Link href={`/tenant/maintenance/${req.id}`} className="font-medium hover:underline">
                            {req.title}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{req.status}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{formatDate(req.createdAt)}</td>
                        <td className="py-2 text-muted-foreground">{formatDate(req.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-2">
                <Link href="/tenant/maintenance" className="text-xs text-muted-foreground hover:underline">
                  View all →
                </Link>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-muted-foreground">No open requests.</p>
              <Link href="/tenant/maintenance" className="text-xs text-muted-foreground hover:underline">
                Submit a request →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HugeiconsIcon icon={FileAttachmentIcon} size={16} />
            Documents
          </CardTitle>
          <CardDescription>Recent files</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {recentDocs.length > 0 ? (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Filename</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-4">Linked To</th>
                      <th className="text-left font-medium text-muted-foreground pb-2">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-4">
                          <Link href={`/tenant/documents/${doc.id}`} className="font-medium hover:underline">
                            {doc.filename}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {doc.lease ? (
                            <Link href={`/tenant/lease?lease=${doc.lease.id}`} className="font-bold hover:underline">
                              Lease {formatDate(doc.lease.startDate)} — {formatDate(doc.lease.endDate)}
                            </Link>
                          ) : doc.unit ? (
                            <span className="font-bold">Unit: {doc.unit.name}</span>
                          ) : doc.property ? (
                            <span className="font-bold">Property: {doc.property.name}</span>
                          ) : "—"}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {formatDate(doc.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-2">
                <Link href="/tenant/documents" className="text-xs text-muted-foreground hover:underline">
                  View all →
                </Link>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No documents yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
