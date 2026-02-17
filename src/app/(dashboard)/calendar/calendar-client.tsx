"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";

const locales = {
  "en-US": require("date-fns/locale/en-US"),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type LeaseEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    tenantName: string;
    propertyName: string;
    unitName: string;
    rentAmount: string;
    status: string;
    paymentCycle: string;
  };
};

type Lease = {
  id: string;
  startDate: string;
  endDate: string;
  rentAmount: string;
  status: string;
  paymentCycle: string;
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

export default function CalendarClient() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<LeaseEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentView, setCurrentView] = useState<View>("month");

  useEffect(() => {
    fetchLeases();
  }, []);

  const fetchLeases = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/leases?limit=1000");

      if (!response.ok) {
        throw new Error("Failed to fetch leases");
      }

      const data = await response.json();
      setLeases(data.items || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leases");
    } finally {
      setIsLoading(false);
    }
  };

  const events: LeaseEvent[] = useMemo(() => {
    return leases.map((lease) => ({
      id: lease.id,
      title: `${lease.tenant.fullName} - ${lease.unit.property.name} / ${lease.unit.name}`,
      start: new Date(lease.startDate),
      end: new Date(lease.endDate),
      resource: {
        tenantName: lease.tenant.fullName,
        propertyName: lease.unit.property.name,
        unitName: lease.unit.name,
        rentAmount: lease.rentAmount,
        status: lease.status,
        paymentCycle: lease.paymentCycle,
      },
    }));
  }, [leases]);

  const handleSelectEvent = useCallback((event: LeaseEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  }, []);

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedEvent(null);
  };

  const eventStyleGetter = (event: LeaseEvent) => {
    const { status } = event.resource;

    let backgroundColor = "#3174ad";
    if (status === "DRAFT") backgroundColor = "#9ca3af";
    if (status === "ACTIVE") backgroundColor = "#10b981";
    if (status === "ENDED") backgroundColor = "#6b7280";
    if (status === "CANCELLED") backgroundColor = "#ef4444";

    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: "0px",
        display: "block",
      },
    };
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "secondary";
      case "ACTIVE":
        return "default";
      case "ENDED":
        return "outline";
      case "CANCELLED":
        return "destructive";
      default:
        return "default";
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lease Calendar</h1>
          <p className="text-muted-foreground mt-1">
            View all lease agreements in a calendar view
          </p>
        </div>
        <HugeiconsIcon
          icon={Calendar03Icon}
          strokeWidth={2}
          className="h-8 w-8 text-muted-foreground"
        />
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: "#9ca3af" }} />
              <span className="text-sm">Draft</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: "#10b981" }} />
              <span className="text-sm">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: "#6b7280" }} />
              <span className="text-sm">Ended</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: "#ef4444" }} />
              <span className="text-sm">Cancelled</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[600px] w-full" />
            </div>
          ) : (
            <div style={{ height: "700px" }}>
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: "100%" }}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                view={currentView}
                onView={setCurrentView}
                views={["month", "week", "day", "agenda"]}
                popup
                tooltipAccessor={(event) => event.title}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lease Details</DialogTitle>
            <DialogDescription>
              Information about this lease agreement
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Tenant
                </label>
                <p className="text-base font-semibold">
                  {selectedEvent.resource.tenantName}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Property / Unit
                </label>
                <p className="text-base">
                  {selectedEvent.resource.propertyName} /{" "}
                  {selectedEvent.resource.unitName}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Start Date
                  </label>
                  <p className="text-base">
                    {format(selectedEvent.start, "MMM dd, yyyy")}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    End Date
                  </label>
                  <p className="text-base">
                    {format(selectedEvent.end, "MMM dd, yyyy")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Rent Amount
                  </label>
                  <p className="text-base font-semibold">
                    {formatCurrency(selectedEvent.resource.rentAmount)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Payment Cycle
                  </label>
                  <p className="text-base">
                    {selectedEvent.resource.paymentCycle}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(selectedEvent.resource.status) as any}>
                    {selectedEvent.resource.status}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    window.location.href = `/leases/${selectedEvent.id}`;
                  }}
                >
                  View Lease
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
