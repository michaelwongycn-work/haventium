import { checkPageAccess, AccessDenied } from "@/lib/guards"
import NotificationRulesClient from "./rules-client"

export default async function NotificationRulesPage() {
  const { authorized } = await checkPageAccess("notifications", "read")

  if (!authorized) {
    return <AccessDenied resource="Notification Rules" />
  }

  return <NotificationRulesClient />
}
