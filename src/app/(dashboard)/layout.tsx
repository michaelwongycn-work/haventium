import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { UserNav } from "@/components/user-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const tierName = session.user.subscription?.tier?.name || "Free Plan"

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Navigation */}
      <header className="border-b">
        <div className="flex h-16 items-center px-4 gap-4">
          <Link href="/dashboard" className="font-semibold text-xl">
            Haventium
          </Link>

          <nav className="flex flex-1 items-center gap-4 ml-8">
            <Link
              href="/dashboard"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Dashboard
            </Link>
            <Link
              href="/properties"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Properties
            </Link>
            <Link
              href="/tenants"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Tenants
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Badge variant="secondary">{tierName}</Badge>
            <UserNav user={session.user} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}

