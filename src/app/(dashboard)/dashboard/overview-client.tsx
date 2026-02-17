"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { formatDateShort, formatCurrency } from "@/lib/format";

type Lease = {
  id: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  tenant: {
    fullName: string;
  };
  unit: {
    name: string;
    property: {
      name: string;
    };
  };
};

type OverviewData = {
  counts: {
    properties: number;
    units: number;
    availableUnits: number;
    activeTenants: number;
    totalTenants: number;
    activeLeases: number;
    draftLeases: number;
  };
  revenue: {
    expected: number;
    collected: number;
    month: number;
    year: number;
  };
  occupancy: {
    rate: number;
    activeLeases: number;
    totalUnits: number;
  };
  expiringSoon: Lease[];
  upcomingPayments: Lease[];
};


const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function OverviewClient({ userName }: { userName: string }) {
  const currentDate = new Date();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/dashboard/overview?month=${selectedMonth}&year=${selectedYear}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, selectedYear]);

  const handleMonthYearChange = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-32 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!data) return null;

  const now = new Date();
  const inactiveTenantCount =
    data.counts.totalTenants - data.counts.activeTenants;
  const unavailableUnitCount = data.counts.units - data.counts.availableUnits;

  return (
    <div className="space-y-8">
      {/* Row 1: Key counts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.properties}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.units}</div>
            <p className="text-xs text-muted-foreground">
              {data.counts.availableUnits} available · {unavailableUnitCount}{" "}
              unavailable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.totalTenants}</div>
            <p className="text-xs text-muted-foreground">
              {data.counts.activeTenants} active · {inactiveTenantCount}{" "}
              inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Leases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.activeLeases}</div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Revenue + Occupancy */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Monthly Revenue
            </CardTitle>
            <CardAction>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) =>
                    handleMonthYearChange(Number(e.target.value), selectedYear)
                  }
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) =>
                    handleMonthYearChange(selectedMonth, Number(e.target.value))
                  }
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  {Array.from(
                    { length: 5 },
                    (_, i) => currentDate.getFullYear() - 2 + i,
                  ).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.revenue.collected)}
            </div>
            <p className="text-xs text-muted-foreground">
              Expected: {formatCurrency(data.revenue.expected)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Draft Leases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.draftLeases}</div>
            <p className="text-xs text-muted-foreground">
              Pending lease agreements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Occupancy Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.occupancy.rate}%</div>
            <p className="text-xs text-muted-foreground">
              {data.occupancy.activeLeases} of {data.occupancy.totalUnits} units
              occupied
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Expiring Soon + Earliest to Expire */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expiring Soon ({data.expiringSoon.length})</CardTitle>
            <CardDescription>
              Active leases expiring within 30 days with no renewal
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.expiringSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No leases expiring soon without a renewal
              </p>
            ) : (
              <div className="space-y-3">
                {data.expiringSoon.slice(0, 5).map((lease) => {
                  const endDate = new Date(lease.endDate);
                  const daysLeft = Math.ceil(
                    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                  );
                  return (
                    <Link
                      key={lease.id}
                      href={`/leases/${lease.id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {lease.tenant.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lease.unit.property.name} - {lease.unit.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{daysLeft}d left</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateShort(endDate)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Payments ({data.upcomingPayments?.length || 0})</CardTitle>
            <CardDescription>
              Unpaid leases sorted by payment due date
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!data.upcomingPayments || data.upcomingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming payments
              </p>
            ) : (
              <div className="space-y-3">
                {data.upcomingPayments.slice(0, 5).map((lease) => {
                  const startDate = new Date(lease.startDate);
                  const daysUntil = Math.ceil(
                    (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                  );
                  return (
                    <Link
                      key={lease.id}
                      href={`/leases/${lease.id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {lease.tenant.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lease.unit.property.name} - {lease.unit.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatCurrency(lease.rentAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Due in {daysUntil}d
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
