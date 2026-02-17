import { checkPageAccess, AccessDenied } from "@/lib/guards"
import LeaseDetailClient from "./lease-detail-client"

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { authorized } = await checkPageAccess("leases", "read")

  if (!authorized) {
    return <AccessDenied resource="Lease Details" />
  }

  const { id } = await params

  return <LeaseDetailClient params={{ id }} />
}
