import { checkPageAccess, AccessDenied } from "@/lib/guards";
import CalendarClient from "./calendar-client";

export default async function CalendarPage() {
  const { authorized } = await checkPageAccess("leases", "read");

  if (!authorized) {
    return <AccessDenied resource="leases" />;
  }

  return <CalendarClient />;
}
