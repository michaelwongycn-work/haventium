import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyTenantSession, TENANT_SESSION_COOKIE } from "@/lib/tenant-auth";
import { prisma } from "@/lib/prisma";
import { FormatProvider } from "@/components/format-provider";
import TenantPortalNav from "./nav";

export default async function TenantPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TENANT_SESSION_COOKIE)?.value;

  if (!token) {
    redirect("/tenant/login");
  }

  const session = await verifyTenantSession(token);
  if (!session) {
    redirect("/tenant/login");
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, currency: true, dateFormat: true },
  });

  return (
    <FormatProvider
      currency={org?.currency ?? "USD"}
      dateFormat={org?.dateFormat ?? "dd/MM/yyyy"}
    >
      <div className="min-h-screen bg-background">
        <TenantPortalNav orgName={org?.name ?? "Tenant Portal"} />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </FormatProvider>
  );
}
