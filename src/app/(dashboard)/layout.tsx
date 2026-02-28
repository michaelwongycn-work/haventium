import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { UserNav } from "@/components/user-nav";
import { NavLinks } from "./nav-links";
import { FormatProvider } from "@/components/format-provider";
import { prisma } from "@/lib/prisma";
import { SubscriptionExpiryBanner } from "@/components/subscription-expiry-banner";

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

  // Compute days until subscription period ends for expiry warning
  // Use monthlyPrice = 0 to detect free/no-cost tiers instead of hardcoded type check
  const endDate = session.user.subscription?.endDate;
  const subscriptionStatus = session.user.subscription?.status;
  const isPaidTier = (session.user.subscription?.tier?.monthlyPrice ?? 0) > 0;
  const daysUntilExpiry =
    endDate && isPaidTier
      ? Math.ceil(
          (new Date(endDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  // Fetch organization format preferences
  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      dateFormat: true,
      currency: true,
    },
  });

  const formatPrefs = {
    dateFormat: organization?.dateFormat || "dd/MM/yyyy",
    currency: organization?.currency || "USD",
  };

  return (
    <FormatProvider
      dateFormat={formatPrefs.dateFormat}
      currency={formatPrefs.currency}
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

        {/* Subscription expiry warning banner */}
        <SubscriptionExpiryBanner
          daysUntilExpiry={daysUntilExpiry}
          subscriptionStatus={subscriptionStatus ?? null}
        />

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </FormatProvider>
  );
}
