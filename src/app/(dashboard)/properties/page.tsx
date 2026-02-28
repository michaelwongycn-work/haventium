import { checkPageAccess, AccessDenied } from "@/lib/guards";
import PropertiesClient from "./properties-client";

export default async function PropertiesPage() {
  const { authorized, roles, features } = await checkPageAccess("properties", "read");

  if (!authorized) {
    return <AccessDenied resource="Properties" />;
  }

  return <PropertiesClient roles={roles} features={features} />;
}
