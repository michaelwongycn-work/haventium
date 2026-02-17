import { checkPageAccess } from "@/lib/guards";
import { AccessDenied } from "@/components/access-denied";
import MaintenanceRequestsClient from "./maintenance-requests-client";

export default async function MaintenanceRequestsPage() {
  const { authorized } = await checkPageAccess("maintenance", "read");

  if (!authorized) {
    return <AccessDenied />;
  }

  return <MaintenanceRequestsClient />;
}
