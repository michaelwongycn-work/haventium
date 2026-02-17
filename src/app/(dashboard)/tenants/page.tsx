import { checkPageAccess, AccessDenied } from "@/lib/guards"
import TenantsClient from "./tenants-client"

export default async function TenantsPage() {
  const { authorized } = await checkPageAccess("tenants", "read")

  if (!authorized) {
    return <AccessDenied resource="Tenants" />
  }

  return <TenantsClient />
}
