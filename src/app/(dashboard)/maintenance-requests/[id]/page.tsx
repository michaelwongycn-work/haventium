import { checkPageAccess } from "@/lib/guards";
import { AccessDenied } from "@/components/access-denied";
import MaintenanceRequestDetailClient from "./maintenance-request-detail-client";

export default async function MaintenanceRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { authorized } = await checkPageAccess("maintenance", "read");

  if (!authorized) {
    return <AccessDenied />;
  }

  const { id } = await params;

  return <MaintenanceRequestDetailClient id={id} />;
}
