import { checkPageAccess, AccessDenied } from "@/lib/guards";
import ApiKeysClient from "./api-keys-client";

export default async function ApiKeysPage() {
  const { authorized } = await checkPageAccess("settings", "manage");

  if (!authorized) {
    return <AccessDenied resource="API Keys" />;
  }

  return <ApiKeysClient />;
}
