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
  const authorized =
    hasAccess(roles, "settings", "manage") ||
    hasAccess(roles, "users", "manage");

  if (!authorized) {
    return <AccessDenied resource="Settings" />;
  }

  return <SettingsClient />;
}
