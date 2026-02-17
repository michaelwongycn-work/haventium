"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Notification03Icon,
} from "@hugeicons/core-free-icons";
import { Pagination } from "@/components/pagination";

type NotificationTrigger =
  | "PAYMENT_REMINDER"
  | "PAYMENT_LATE"
  | "PAYMENT_CONFIRMED"
  | "LEASE_EXPIRING"
  | "LEASE_EXPIRED"
  | "MANUAL";

type NotificationChannel = "EMAIL" | "WHATSAPP" | "TELEGRAM";

type NotificationStatus = "PENDING" | "SENT" | "FAILED";

type NotificationLog = {
  id: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  trigger: NotificationTrigger;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  status: NotificationStatus;
  sentAt: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginatedResponse = {
  logs: NotificationLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  PAYMENT_REMINDER: "Payment Reminder",
  PAYMENT_LATE: "Payment Late",
  PAYMENT_CONFIRMED: "Payment Confirmed",
  LEASE_EXPIRING: "Lease Expiring",
  LEASE_EXPIRED: "Lease Expired",
  MANUAL: "Manual",
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
};

const STATUS_LABELS: Record<NotificationStatus, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  FAILED: "Failed",
};

export default function NotificationLogsClient() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter !== "all") params.append("status", statusFilter);
      if (triggerFilter !== "all") params.append("trigger", triggerFilter);
      if (channelFilter !== "all") params.append("channel", channelFilter);

      const response = await fetch(`/api/notifications/logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch logs");

      const data: PaginatedResponse = await response.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch {
      setError("Failed to load notification logs");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, triggerFilter, channelFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const goToPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const getStatusBadge = (status: NotificationStatus) => {
    switch (status) {
      case "SENT":
        return <Badge variant="default">Sent</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      case "PENDING":
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>
            Track the delivery status of all sent notifications
          </CardDescription>
          <div className="flex gap-4 pt-4">
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={triggerFilter} onValueChange={setTriggerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by trigger" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Triggers</SelectItem>
                  {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HugeiconsIcon
                icon={Notification03Icon}
                className="mb-4 h-12 w-12 text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                No notification logs found. Notifications will appear here once
                they are sent.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="text-sm">
                          {log.recipientEmail ||
                            log.recipientPhone ||
                            "Unknown"}
                        </div>
                        {log.subject && (
                          <div className="text-xs text-muted-foreground">
                            {log.subject}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{TRIGGER_LABELS[log.trigger]}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CHANNEL_LABELS[log.channel]}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        {log.sentAt ? (
                          <span className="text-sm">
                            {formatDate(log.sentAt)}
                          </span>
                        ) : log.failedReason ? (
                          <span
                            className="text-xs text-destructive"
                            title={log.failedReason}
                          >
                            {log.failedReason.substring(0, 30)}...
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatDate(log.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination.totalPages > 0 && (
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  pageSize={pagination.limit}
                  onPageChange={(page) => goToPage(page)}
                  onPageSizeChange={(size) => {
                    setPagination((prev) => ({ ...prev, limit: size, page: 1 }));
                  }}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
