import { checkPageAccess, AccessDenied } from "@/lib/guards";
import MaintenanceRequestsClient from "./maintenance-requests-client";

export default async function MaintenanceRequestsPage() {
  const { authorized } = await checkPageAccess("maintenance", "read");

  if (!authorized) {
    return <AccessDenied resource="maintenance requests" />;
  }

  return <MaintenanceRequestsClient />;
}
