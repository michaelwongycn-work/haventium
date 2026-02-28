import { checkPageAccess, AccessDenied } from "@/lib/guards";
import DocumentsClient from "./documents-client";

export default async function DocumentsPage() {
  const { authorized, features } = await checkPageAccess("documents", "read");

  if (!authorized) {
    return <AccessDenied resource="documents" />;
  }

  return <DocumentsClient features={features} />;
}
