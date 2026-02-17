import { checkPageAccess, AccessDenied } from "@/lib/guards";
import UnitDetailClient from "./unit-detail-client";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  const { id, unitId } = await params;

  const { authorized, roles } = await checkPageAccess(
    "properties",
    "read",
  );

  if (!authorized) {
    return <AccessDenied resource="properties" />;
  }

  return <UnitDetailClient params={{ propertyId: id, unitId }} roles={roles} />;
}
