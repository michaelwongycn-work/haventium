import { checkPageAccess, AccessDenied } from "@/lib/guards";
import MaintenanceRequestDetailClient from "./maintenance-request-detail-client";

export default async function MaintenanceRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { authorized } = await checkPageAccess("maintenance", "read");

  if (!authorized) {
    return <AccessDenied resource="maintenance request" />;
  }

  const { id } = await params;

  return <MaintenanceRequestDetailClient id={id} />;
}
