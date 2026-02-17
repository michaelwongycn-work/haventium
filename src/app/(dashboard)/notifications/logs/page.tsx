import { checkPageAccess, AccessDenied } from "@/lib/guards";
import NotificationLogsClient from "./logs-client";

export default async function NotificationLogsPage() {
  const { authorized } = await checkPageAccess("notifications", "read");

  if (!authorized) {
    return <AccessDenied resource="Notification Logs" />;
  }

  return <NotificationLogsClient />;
}
