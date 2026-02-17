import { checkPageAccess, AccessDenied } from "@/lib/guards"
import PropertyDetailClient from "./property-detail-client"

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { authorized, roles } = await checkPageAccess("properties", "read")

  if (!authorized) {
    return <AccessDenied resource="Property Details" />
  }

  const { id } = await params
  return <PropertyDetailClient params={{ id }} roles={roles} />
}
