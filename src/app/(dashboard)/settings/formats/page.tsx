import { checkPageAccess, AccessDenied } from "@/lib/guards";
import { FormatsClient } from "./formats-client";

export default async function FormatsPage() {
  const { authorized } = await checkPageAccess("settings", "manage");

  if (!authorized) {
    return <AccessDenied resource="format settings" />;
  }

  return <FormatsClient />;
}
