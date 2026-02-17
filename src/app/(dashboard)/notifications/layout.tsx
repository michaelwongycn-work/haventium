"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const links = [
    { href: "/notifications/templates", label: "Templates" },
    { href: "/notifications/rules", label: "Rules" },
    { href: "/notifications/logs", label: "Logs" },
  ]

  return (
    <div className="space-y-6">
      <div className="border-b">
        <nav className="flex space-x-6">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href)

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`border-b-2 pb-3 text-sm font-medium transition-colors hover:text-primary ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
      {children}
    </div>
  )
}
