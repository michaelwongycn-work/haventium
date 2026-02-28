import { redirect } from "next/navigation";
import { AccessDenied, hasAccess, checkPageAccess } from "@/lib/guards";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  // Use checkPageAccess for any settings/users resource to get features
  const { session, features } = await checkPageAccess("settings", "manage");

  const roles = session.user.roles || [];
  const hasSettingsManage = hasAccess(roles, "settings", "manage");
  const hasUsersManage = hasAccess(roles, "users", "manage");
  const authorized = hasSettingsManage || hasUsersManage;

  if (!authorized) {
    return <AccessDenied resource="Settings" />;
  }

  const baseUrl = process.env.PUBLIC_URL ?? "http://localhost:3000";

  return (
    <SettingsClient
      hasSettingsManage={hasSettingsManage}
      hasUsersManage={hasUsersManage}
      xenditWebhookUrl={`${baseUrl}/api/webhooks/xendit/rent`}
      features={features}
    />
  );
}
