import { checkPageAccess, AccessDenied } from "@/lib/guards";
import NotificationsClient from "./notifications-client";

export default async function NotificationsPage() {
  const { authorized } = await checkPageAccess("notifications", "read");

  if (!authorized) {
    return <AccessDenied resource="Notifications" />;
  }

  return <NotificationsClient />;
}
