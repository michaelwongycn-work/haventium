import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccessDenied, hasAccess } from "@/lib/guards";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const roles = session.user.roles || [];
  const hasSettingsManage = hasAccess(roles, "settings", "manage");
  const hasUsersManage = hasAccess(roles, "users", "manage");
  const authorized = hasSettingsManage || hasUsersManage;

  if (!authorized) {
    return <AccessDenied resource="Settings" />;
  }

  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

  return (
    <SettingsClient
      hasSettingsManage={hasSettingsManage}
      hasUsersManage={hasUsersManage}
      xenditWebhookUrl={`${baseUrl}/api/webhooks/xendit/rent`}
    />
  );
}
