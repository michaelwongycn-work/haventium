import { checkPageAccess, AccessDenied } from "@/lib/guards";
import AnalyticsClient from "./analytics-client";

export default async function AnalyticsPage() {
  const { authorized } = await checkPageAccess("leases", "read");

  if (!authorized) {
    return <AccessDenied resource="leases" />;
  }

  return <AnalyticsClient />;
}
