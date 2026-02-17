import { checkPageAccess, AccessDenied } from "@/lib/guards"
import TenantDetailClient from "./tenant-detail-client"

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { authorized } = await checkPageAccess("tenants", "read")

  if (!authorized) {
    return <AccessDenied resource="Tenant Details" />
  }

  const { id } = await params
  
  return <TenantDetailClient params={{ id }} />
}
