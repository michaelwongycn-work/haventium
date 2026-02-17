"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  formatDateLong,
  formatCurrency as formatCurrencyUtil,
} from "@/lib/format";
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
import { Calendar03Icon, ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type EventType = "start" | "payment" | "grace_end" | "expiration";

type LeaseEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: {
    leaseId: string;
    eventType: EventType;
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
  gracePeriodDays: number | null;
  paidAt: string | null;
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
  const [currentDate, setCurrentDate] = useState(new Date());

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
    const allEvents: LeaseEvent[] = [];

    leases.forEach((lease) => {
      const tenantName = lease.tenant.fullName;
      const location = `${lease.unit.property.name} / ${lease.unit.name}`;

      // 1. Lease Start Date
      allEvents.push({
        id: `${lease.id}-start`,
        title: `Lease Start: ${tenantName}`,
        start: new Date(lease.startDate),
        end: new Date(lease.startDate),
        allDay: true,
        resource: {
          leaseId: lease.id,
          eventType: "start",
          tenantName,
          propertyName: lease.unit.property.name,
          unitName: lease.unit.name,
          rentAmount: lease.rentAmount,
          status: lease.status,
          paymentCycle: lease.paymentCycle,
        },
      });

      // 2. Grace Period End (for DRAFT leases)
      if (lease.status === "DRAFT" && lease.gracePeriodDays) {
        const graceEndDate = new Date(lease.startDate);
        graceEndDate.setDate(graceEndDate.getDate() + lease.gracePeriodDays);

        allEvents.push({
          id: `${lease.id}-grace`,
          title: `Grace Period Ends: ${tenantName}`,
          start: graceEndDate,
          end: graceEndDate,
          allDay: true,
          resource: {
            leaseId: lease.id,
            eventType: "grace_end",
            tenantName,
            propertyName: lease.unit.property.name,
            unitName: lease.unit.name,
            rentAmount: lease.rentAmount,
            status: lease.status,
            paymentCycle: lease.paymentCycle,
          },
        });
      }

      // 3. Payment Due (for unpaid DRAFT/ACTIVE leases)
      if (
        !lease.paidAt &&
        (lease.status === "DRAFT" || lease.status === "ACTIVE")
      ) {
        const paymentDueDate = new Date(lease.startDate);

        allEvents.push({
          id: `${lease.id}-payment`,
          title: `Payment Due: ${tenantName}`,
          start: paymentDueDate,
          end: paymentDueDate,
          allDay: true,
          resource: {
            leaseId: lease.id,
            eventType: "payment",
            tenantName,
            propertyName: lease.unit.property.name,
            unitName: lease.unit.name,
            rentAmount: lease.rentAmount,
            status: lease.status,
            paymentCycle: lease.paymentCycle,
          },
        });
      }

      // 4. Lease Expiration (for ACTIVE leases)
      if (lease.status === "ACTIVE") {
        allEvents.push({
          id: `${lease.id}-expiration`,
          title: `Lease Expires: ${tenantName}`,
          start: new Date(lease.endDate),
          end: new Date(lease.endDate),
          allDay: true,
          resource: {
            leaseId: lease.id,
            eventType: "expiration",
            tenantName,
            propertyName: lease.unit.property.name,
            unitName: lease.unit.name,
            rentAmount: lease.rentAmount,
            status: lease.status,
            paymentCycle: lease.paymentCycle,
          },
        });
      }
    });

    return allEvents;
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
    const { eventType } = event.resource;

    let backgroundColor = "#3174ad";

    // Color by event type
    if (eventType === "start") backgroundColor = "#10b981"; // Green
    if (eventType === "payment") backgroundColor = "#f59e0b"; // Amber
    if (eventType === "grace_end") backgroundColor = "#ef4444"; // Red
    if (eventType === "expiration") backgroundColor = "#8b5cf6"; // Purple

    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: "0px",
        display: "block",
        fontSize: "0.875rem",
      },
    };
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
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Event Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded"
                style={{ backgroundColor: "#10b981" }}
              />
              <span className="text-sm">Lease Start</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded"
                style={{ backgroundColor: "#f59e0b" }}
              />
              <span className="text-sm">Payment Due</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded"
                style={{ backgroundColor: "#ef4444" }}
              />
              <span className="text-sm">Grace Period Ends</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded"
                style={{ backgroundColor: "#8b5cf6" }}
              />
              <span className="text-sm">Lease Expires</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{format(currentDate, "MMMM yyyy")}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentDate(new Date())}
              >
                Current Month
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                view="month"
                date={currentDate}
                onNavigate={setCurrentDate}
                views={["month"]}
                toolbar={false}
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
            <DialogTitle>Event Details</DialogTitle>
            <DialogDescription>
              {selectedEvent?.resource.eventType === "start" &&
                "Lease start date"}
              {selectedEvent?.resource.eventType === "payment" &&
                "Payment due date"}
              {selectedEvent?.resource.eventType === "grace_end" &&
                "Grace period end date"}
              {selectedEvent?.resource.eventType === "expiration" &&
                "Lease expiration date"}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Event Type
                </label>
                <p className="text-base font-semibold">
                  {selectedEvent.resource.eventType === "start" &&
                    "Lease Start"}
                  {selectedEvent.resource.eventType === "payment" &&
                    "Payment Due"}
                  {selectedEvent.resource.eventType === "grace_end" &&
                    "Grace Period Ends"}
                  {selectedEvent.resource.eventType === "expiration" &&
                    "Lease Expires"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Date
                </label>
                <p className="text-base font-semibold">
                  {formatDateLong(selectedEvent.start)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Tenant
                </label>
                <p className="text-base">{selectedEvent.resource.tenantName}</p>
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
                    Rent Amount
                  </label>
                  <p className="text-base">
                    {formatCurrencyUtil(selectedEvent.resource.rentAmount)}
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
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    window.location.href = `/leases/${selectedEvent.resource.leaseId}`;
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
