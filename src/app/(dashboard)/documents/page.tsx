import { checkPageAccess } from "@/lib/guards";
import { AccessDenied } from "@/components/access-denied";
import DocumentsClient from "./documents-client";

export default async function DocumentsPage() {
  const { authorized } = await checkPageAccess("documents", "read");

  if (!authorized) {
    return <AccessDenied />;
  }

  return <DocumentsClient />;
}
