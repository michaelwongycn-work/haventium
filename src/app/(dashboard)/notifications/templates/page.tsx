import { checkPageAccess, AccessDenied } from "@/lib/guards";
import NotificationTemplatesClient from "./templates-client";

export default async function NotificationTemplatesPage() {
  const { authorized } = await checkPageAccess("notifications", "read");

  if (!authorized) {
    return <AccessDenied resource="Notification Templates" />;
  }

  return <NotificationTemplatesClient />;
}
