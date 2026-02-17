import { checkPageAccess, AccessDenied } from "@/lib/guards";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const { authorized, session } = await checkPageAccess("leases", "read");

  if (!authorized) {
    return <AccessDenied resource="dashboard" />;
  }

  return <DashboardClient userName={session.user.name || "User"} />;
}
