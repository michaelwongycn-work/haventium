import { checkPageAccess, AccessDenied } from "@/lib/guards"
import LeasesClient from "./leases-client"

export default async function LeasesPage() {
  const { authorized } = await checkPageAccess("leases", "read")

  if (!authorized) {
    return <AccessDenied resource="Leases" />
  }

  return <LeasesClient />
}
