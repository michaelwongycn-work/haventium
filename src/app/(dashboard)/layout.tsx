import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { UserNav } from "@/components/user-nav";
import { NavLinks } from "./nav-links";
import { FormatProvider } from "@/components/format-provider";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const tierName = session.user.subscription?.tier?.name || "Free Plan";
  const roles = session.user.roles || [];

  // Fetch organization format preferences
  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      dateFormat: true,
      currency: true,
      currencySymbol: true,
    },
  });

  const formatPrefs = {
    dateFormat: organization?.dateFormat || "dd/MM/yyyy",
    currency: organization?.currency || "USD",
    currencySymbol: organization?.currencySymbol || "$",
  };

  return (
    <FormatProvider
      dateFormat={formatPrefs.dateFormat}
      currency={formatPrefs.currency}
      currencySymbol={formatPrefs.currencySymbol}
    >
      <div className="flex min-h-screen flex-col">
        {/* Top Navigation */}
        <header className="border-b">
          <div className="flex h-16 items-center px-4 gap-4">
            <Link href="/dashboard" className="font-semibold text-xl">
              Haventium
            </Link>

            <nav className="flex flex-1 items-center gap-4 ml-8">
              <NavLinks roles={roles} />
            </nav>

            <div className="flex items-center gap-4">
              <Badge variant="secondary">{tierName}</Badge>
              <UserNav user={session.user} roles={roles} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </FormatProvider>
  );
}
